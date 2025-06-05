function formatDate(isoString) {
  const date = new Date(isoString);

  const options = {
    year: "numeric",
    month: "long",
    day: "numeric",
  };

  // Format like "May 1, 2025"
  const formatted = date.toLocaleDateString("en-US", options);

  // Add ordinal suffix to the day
  const day = date.getDate();
  const suffix =
    day % 10 === 1 && day !== 11 ? "st" :
    day % 10 === 2 && day !== 12 ? "nd" :
    day % 10 === 3 && day !== 13 ? "rd" :
    "th";

  return formatted.replace(/\d+/, `${day}${suffix}`);
}
export default formatDate;