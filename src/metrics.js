const config = require('./config');
const os = require('os');


// Metrics stored in memory
const requests = {
    total: 0,
    byMethod: { GET: 0, PUT: 0, POST: 0, DELETE: 0 },
    byEndpoint: {},
};

const authMetrics = {
    successfulAttempts: 0,
    failedAttempts: 0,
};

const pizzaMetrics = {
    sold: 0,
    creationFailures: 0,
    revenue: 0,
};

const latencyMetrics = {
    endpoints: {},
    pizzaCreation: [],
};

const activeUsers = new Set();

// Middleware to track requests and latency
function requestTracker(req, res, next) {
    const startTime = Date.now();

    // Track HTTP method
    const method = req.method;
    requests.total += 1;
    if (requests.byMethod[method]) {
        requests.byMethod[method] += 1;
    }

    // Track by endpoint
    const endpoint = `${req.method} ${req.path}`;
    requests.byEndpoint[endpoint] = (requests.byEndpoint[endpoint] || 0) + 1;

    // Track active user if authenticated
    if (req.user && req.user.id) {
        activeUsers.add(req.user.id);
    }

    // Capture original res.json and res.send to track latency
    const originalJson = res.json;
    const originalSend = res.send;

    const trackLatency = () => {
        const latency = Date.now() - startTime;
        // Track endpoint latency
        if (!latencyMetrics.endpoints[endpoint]) {
            latencyMetrics.endpoints[endpoint] = [];
        }
        latencyMetrics.endpoints[endpoint].push(latency);
        // Keep only last 100 measurements per endpoint
        if (latencyMetrics.endpoints[endpoint].length > 100) {
            latencyMetrics.endpoints[endpoint].shift();
        }
    };

    res.json = function (data) {
        trackLatency();
        return originalJson.call(this, data);
    };

    res.send = function (data) {
        trackLatency();
        return originalSend.call(this, data);
    };

    next();
}

// This will periodically send metrics to Grafana
setInterval(() => {
    const metrics = [];
    console.log('[METRICS] Preparing metrics batch. Total requests:', requests.total);

    // HTTP requests by method/minute
    metrics.push(createMetric('http_requests_total', requests.total, '1', 'sum', 'asInt'));
    metrics.push(createMetric('http_requests_get', requests.byMethod.GET, '1', 'sum', 'asInt'));
    metrics.push(createMetric('http_requests_put', requests.byMethod.PUT, '1', 'sum', 'asInt'));
    metrics.push(createMetric('http_requests_post', requests.byMethod.POST, '1', 'sum', 'asInt'));
    metrics.push(createMetric('http_requests_delete', requests.byMethod.DELETE, '1', 'sum', 'asInt'));

    // Active users
    metrics.push(createMetric('active_users', activeUsers.size, '1', 'gauge', 'asInt'));

    // Authentication attempts
    metrics.push(createMetric('auth_attempts_successful', authMetrics.successfulAttempts, '1', 'sum', 'asInt'));
    metrics.push(createMetric('auth_attempts_failed', authMetrics.failedAttempts, '1', 'sum', 'asInt'));

    // CPU and memory usage
    const cpuUsage = getCpuUsagePercentage();
    const memoryUsage = getMemoryUsagePercentage();
    metrics.push(createMetric('cpu_usage_percent', cpuUsage, '%', 'gauge', 'asDouble'));
    metrics.push(createMetric('memory_usage_percent', memoryUsage, '%', 'gauge', 'asDouble'));

    // Pizza metrics
    metrics.push(createMetric('pizzas_sold', pizzaMetrics.sold, '1', 'sum', 'asInt'));
    metrics.push(createMetric('pizza_creation_failures', pizzaMetrics.creationFailures, '1', 'sum', 'asInt'));
    metrics.push(createMetric('pizza_revenue', pizzaMetrics.revenue, '$', 'sum', 'asDouble'));

    // Latency metrics
    Object.keys(latencyMetrics.endpoints).forEach((endpoint) => {
        const latencies = latencyMetrics.endpoints[endpoint];
        if (latencies.length > 0) {
            const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
            metrics.push(createMetric('endpoint_latency_avg_ms', avgLatency, 'ms', 'gauge', 'asDouble', { endpoint }));
        }
    });

    // Pizza creation latency
    if (latencyMetrics.pizzaCreation.length > 0) {
        const avgPizzaLatency = latencyMetrics.pizzaCreation.reduce((a, b) => a + b, 0) / latencyMetrics.pizzaCreation.length;
        metrics.push(createMetric('pizza_creation_latency_avg_ms', avgPizzaLatency, 'ms', 'gauge', 'asDouble'));
    }

    console.log('[METRICS] Sending', metrics.length, 'metrics to Grafana');
    sendMetricToGrafana(metrics);

    // Reset minute counters (optional, depending on Grafana setup)
    // requests.byMethod = { GET: 0, PUT: 0, POST: 0, DELETE: 0 };
}, 10000);

function createMetric(metricName, metricValue, metricUnit, metricType, valueType, attributes = {}) {
    attributes = { ...attributes, source: config.metrics.source };

    const metric = {
        name: metricName,
        unit: metricUnit,
        [metricType]: {
            dataPoints: [
                {
                    [valueType]: metricValue,
                    timeUnixNano: Date.now() * 1000000,
                    attributes: [],
                },
            ],
        },
    };

    Object.keys(attributes).forEach((key) => {
        metric[metricType].dataPoints[0].attributes.push({
            key: key,
            value: { stringValue: String(attributes[key]) },
        });
    });

    if (metricType === 'sum') {
        metric[metricType].aggregationTemporality = 'AGGREGATION_TEMPORALITY_CUMULATIVE';
        metric[metricType].isMonotonic = true;
    }

    return metric;
}

function sendMetricToGrafana(metrics) {
    const body = {
        resourceMetrics: [
            {
                scopeMetrics: [
                    {
                        metrics,
                    },
                ],
            },
        ],
    };

    const auth = Buffer.from(
        `${config.metrics.accountId}:${config.metrics.apiKey}`
    ).toString("base64");

    fetch(config.metrics.endpointUrl, {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
            "Content-Type": "application/json",

            // SAME as curl -u accountId:apiKey
            "Authorization": `Basic ${auth}`,
        },
    })
        .then((response) => {
            console.log("[METRICS] status:", response.status);
        })
        .catch((err) => {
            console.error("[METRICS] error:", err);
        });
}

// System metrics functions
function getCpuUsagePercentage() {
    try {
        const loadAverage = os.loadavg()[0];
        const cpuCount = os.cpus().length;
        const cpuUsage = (loadAverage / cpuCount) * 100;
        return parseFloat(cpuUsage.toFixed(2));
    } catch (error) {
        console.error('Error calculating CPU usage:', error);
        return 0;
    }
}

function getMemoryUsagePercentage() {
    try {
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        const memoryUsage = (usedMemory / totalMemory) * 100;
        return parseFloat(memoryUsage.toFixed(2));
    } catch (error) {
        console.error('Error calculating memory usage:', error);
        return 0;
    }
}

// Functions to track specific events
function trackAuthSuccess() {
    authMetrics.successfulAttempts += 1;
}

function trackAuthFailure() {
    authMetrics.failedAttempts += 1;
}

function trackPizzaSold(price = 0) {
    pizzaMetrics.sold += 1;
    pizzaMetrics.revenue += price;
}

function trackPizzaCreationFailure() {
    pizzaMetrics.creationFailures += 1;
}

function trackPizzaCreationLatency(latency) {
    latencyMetrics.pizzaCreation.push(latency);
    // Keep only last 100 measurements
    if (latencyMetrics.pizzaCreation.length > 100) {
        latencyMetrics.pizzaCreation.shift();
    }
}

module.exports = {
    requestTracker,
    trackAuthSuccess,
    trackAuthFailure,
    trackPizzaSold,
    trackPizzaCreationFailure,
    trackPizzaCreationLatency,
};