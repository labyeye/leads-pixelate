// Escapes user input for use inside a $regex (stops ReDoS and wildcard-style data extraction).
module.exports = (s) => String(s).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
