const { initTracer } = require("jaeger-client");

const config = {
  serviceName: "my-nodejs-app",
  sampler: {
    type: "const",
    param: 1,
  },
  reporter: {
    logSpans: true,
    // agentHost: "localhost",
    // agentPort: 4318,
    collectorEndpoint: "http://localhost:14268/api/traces",
  },
};

const options = {
  logger: {
    info(msg) {
      console.log("INFO", msg);
    },
    error(msg) {
      console.log("ERROR", msg);
    },
  },
};

const tracer = initTracer(config, options);

const express = require("express");
// const tracer = require('./jaeger-config'); // Import the Jaeger tracer instance

const app = express();
const port = process.env.PORT || 3000;

const traceMiddleware = (req, res, next) => {
  // Start a new span for the incoming HTTP request
  const span = tracer.startSpan(req.method + " " + req.path);

  // Set tags for the span
  span.setTag("http.method", req.method);
  span.setTag("http.url", req.url);

  // Add the span to the request object to be used in route handlers
  req.span = span;

  // Continue processing the request
  next();
};

const tracedFunction = async (req, fn, ...args) => {
  const span = tracer.startSpan(fn.name, { childOf: req.span });

  try {
    // Call the function with provided arguments and pass span as an argument
    if (fn.name === "functionD") {
      throw new Error("Jaabe");
    }
    await fn(req, span, ...args);
  } catch (error) {
    // Log the error
    console.error(`Error in ${fn.name}:`, error);
    // Set an error tag on the span
    span.setTag("error", true);
    // Set a log message on the span
    span.log({ event: "error", message: error.message });
    // Re-throw the error to propagate it
    throw error;
  } finally {
    // Finish the span in all cases
    span.finish();
  }
};

// Use the traceMiddleware for all routes
app.use(traceMiddleware);

app.get("/", (req, res) => {
  res.send("Hello Jaeger!");
});

const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

// Function A with arguments
const functionA = async (req, span, arg1, arg2) => {
  // Use the span as needed
  await sleep(300); // Simulate processing time
  console.log("Function A executed with arguments:", arg1, arg2);
};

// Function B with arguments
const functionB = async (req, span, arg1) => {
  // Use the span as needed
  await sleep(500); // Simulate processing time
  console.log("Function B executed with argument:", arg1);
};

// Function C with arguments, calling function H
const functionC = async (req, span) => {
  // Use the span as needed
  await sleep(700); // Simulate processing time
  console.log("Function C executed");
};

// Function D with arguments
const functionD = async (req, span, arg1, arg2, arg3) => {
  // Use the span as needed
  await sleep(200); // Simulate processing time
  console.log("Function D executed with arguments:", arg1, arg2, arg3);
  await tracedFunction(req, functionF);
};

// Function E with arguments
const functionE = async (req, span) => {
  // Use the span as needed
  await sleep(400); // Simulate processing time
  console.log("Function E executed");
};

const functionF = async (req, span) => {
  // Use the span as needed
  await sleep(500); // Simulate processing time
  console.log("Function F executed");
};

// API endpoint to trigger functions A to E with arguments
app.get("/test", async (req, res) => {
  try {
    // Call functions A to E sequentially with arguments
    await tracedFunction(req, functionA, "arg1A", "arg2A");
    await tracedFunction(req, functionB, "arg1B");
    await tracedFunction(req, functionC);
    await tracedFunction(req, functionD, "arg1D", "arg2D", "arg3D");
    await tracedFunction(req, functionE);

    // Return a success response
    res.send("Hello World!");
  } catch (error) {
    console.error("Error processing API request:", error);
    res.status(500).send("Internal Server Error");
  } finally {
    // Finish the overall span for the API request
    req.span.finish();
  }
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
