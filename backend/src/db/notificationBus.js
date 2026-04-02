import EventEmitter from "events";
import pool from "./db.js";
import logger from "../logger.js";

const emitter = new EventEmitter();
const CHANNEL = "game_updated";
const RECONNECT_DELAY_MS = 1000;

let listenClient = null;
let subscriberCount = 0;
let shuttingDown = false;

async function connect() {
  try {
    listenClient = await pool.connect();
    await listenClient.query(`LISTEN ${CHANNEL}`);
    listenClient.on("notification", (msg) => emitter.emit("notification", msg));
    listenClient.on("error", (err) => {
      logger.error({ err }, "notificationBus: LISTEN client error");
      listenClient = null;
      if (!shuttingDown && subscriberCount > 0) {
        setTimeout(connect, RECONNECT_DELAY_MS).unref();
      }
    });
    logger.info("notificationBus: LISTEN connection established");
  } catch (err) {
    logger.error({ err }, "notificationBus: failed to connect");
    listenClient = null;
    if (!shuttingDown && subscriberCount > 0) {
      setTimeout(connect, RECONNECT_DELAY_MS).unref();
    }
  }
}

async function disconnect() {
  const client = listenClient;
  listenClient = null;
  if (client) {
    try { await client.query(`UNLISTEN ${CHANNEL}`); } catch { /* ignore */ }
    client.removeAllListeners();
    client.release();
  }
}

export async function subscribe(callback) {
  shuttingDown = false;
  emitter.on("notification", callback);
  subscriberCount++;
  if (subscriberCount === 1) {
    await connect();
  }
}

export async function unsubscribe(callback) {
  emitter.off("notification", callback);
  subscriberCount = Math.max(0, subscriberCount - 1);
  if (subscriberCount === 0) {
    await disconnect();
    logger.info("notificationBus: LISTEN connection released (no subscribers)");
  }
}

export async function shutdown() {
  shuttingDown = true;
  subscriberCount = 0;
  emitter.removeAllListeners();
  await disconnect();
  logger.info("notificationBus: shutdown complete");
}
