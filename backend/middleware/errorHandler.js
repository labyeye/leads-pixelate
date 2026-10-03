const log = require("../utils/logger").scope("Error Handler");

// Mongoose says "Path `name` is required." — turn that into something a client can act on.
const label = (p) =>
  String(p || "field")
    .split(".")
    .pop()
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
const friendly = (v) =>
  v.kind === "required"
    ? `${label(v.path)} is required`
    : v.name === "CastError"
      ? `${label(v.path)} is not valid`
      : v.message;

const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message;

  log.error(message, { path: `${req.method} ${req.originalUrl}` });

  if (err.name === "CastError" && err.kind === "ObjectId") {
    statusCode = 404;
    message = "Resource not found";
  }

  if (err.code === 11000) {
    statusCode = 400;
    message = "A record with that value already exists";
  }

  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors)
      .map(friendly)
      .join(", ");
  }

  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Not authorized";
  }

  // Never leak internals (stack hints, driver errors) to clients on a server fault.
  if (statusCode >= 500 && process.env.NODE_ENV === "production")
    message = "Something went wrong on our side. Please try again in a moment.";

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

const notFound = (req, res, next) => {
  const error = new Error(`Not found — ${req.originalUrl}`);
  res.status(404);
  next(error);
};

module.exports = { errorHandler, notFound };
