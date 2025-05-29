export default function normalize(str){ return (
    str?.toLowerCase().replace(/[^a-z]/g, "")
)}
