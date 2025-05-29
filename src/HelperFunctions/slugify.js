export default function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")     
    .replace(/\s+/g, "-");       
}
