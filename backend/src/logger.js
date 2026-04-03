import pino from "pino";

const isTest = process.env.NODE_ENV === "test";
const isDev = !isTest && process.env.NODE_ENV !== "production";

const logger = pino(
  { level: isTest ? "silent" : process.env.LOG_LEVEL || "info" },
  isDev
    ? pino.transport({
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:HH:MM:ss",
          ignore: "pid,hostname",
        },
      })
    : undefined,
);

export default logger;
