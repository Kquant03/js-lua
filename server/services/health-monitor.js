// server/services/health-monitor.js
const mongoose = require('mongoose');
const Redis = require('ioredis');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class HealthMonitor {
  constructor() {
    this.services = new Map();
    this.metrics = {
      startTime: Date.now(),
      requestCount: 0,
      errorCount: 0,
      activeConnections: 0,
      memoryUsage: {},
      cpuUsage: 0,
      diskUsage: {},
      responseTimesMS: [],
      systemLoad: []
    };
    
    this.alerts = new Map();
    this.checkIntervals = new Map();
    
    // Health check configuration
    this.config = {
      checkInterval: 30000, // 30 seconds
      retentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
      thresholds: {
        responseTime: 1000, // 1 second
        errorRate: 0.05, // 5%
        memoryUsage: 0.9, // 90%
        cpuUsage: 0.8, // 80%
        diskUsage: 0.85 // 85%
      },
      alertCooldown: 5 * 60 * 1000 // 5 minutes
    };

    this.initializeServices();
    this.startMonitoring();
  }

  initializeServices() {
    // Register core services to monitor
    this.services.set('database', {
      name: 'MongoDB',
      type: 'database',
      check: () => this.checkDatabase(),
      critical: true
    });

    this.services.set('redis', {
      name: 'Redis Cache',
      type: 'cache',
      check: () => this.checkRedis(),
      critical: true
    });

    this.services.set('filesystem', {
      name: 'File System',
      type: 'storage',
      check: () => this.checkFileSystem(),
      critical: true
    });

    this.services.set('external_apis', {
      name: 'External APIs',
      type: 'external',
      check: () => this.checkExternalAPIs(),
      critical: false
    });
  }

  async checkDatabase() {
    try {
      const startTime = Date.now();
      
      // Test connection
      if (mongoose.connection.readyState !== 1) {
        throw new Error('Database not connected');
      }

      // Test query performance
      await mongoose.connection.db.admin().ping();
      const responseTime = Date.now() - startTime;

      // Get connection pool stats
      const connections = {
        current: mongoose.connections.length,
        available: mongoose.connection.readyState
      };

      return {
        status: 'healthy',
        responseTime,
        connections,
        details: {
          readyState: mongoose.connection.readyState,
          host: mongoose.connection.host,
          name: mongoose.connection.name
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        details: {
          readyState: mongoose.connection.readyState
        }
      };
    }
  }

  async checkRedis() {
    try {
      const redis = new Redis(process.env.REDIS_URL);
      const startTime = Date.now();
      
      // Test basic operations
      await redis.ping();
      await redis.set('health_check', Date.now(), 'EX', 60);
      await redis.get('health_check');
      
      const responseTime = Date.now() - startTime;

      // Get Redis info
      const info = await redis.info('memory');
      const memoryInfo = this.parseRedisInfo(info);

      redis.disconnect();

      return {
        status: 'healthy',
        responseTime,
        memory: memoryInfo,
        details: {
          connected: true
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  async checkFileSystem() {
    try {
      const uploadsDir = path.join(process.cwd(), 'uploads');
      const logDir = path.join(process.cwd(), 'logs');
      
      // Check disk space
      const stats = await fs.stat(uploadsDir).catch(() => null);
      const diskUsage = await this.getDiskUsage();

      // Test read/write operations
      const testFile = path.join(uploadsDir, 'health_check.tmp');
      const testData = `Health check ${Date.now()}`;
      
      await fs.writeFile(testFile, testData);
      const readData = await fs.readFile(testFile, 'utf8');
      await fs.unlink(testFile);

      if (readData !== testData) {
        throw new Error('File integrity check failed');
      }

      return {
        status: 'healthy',
        diskUsage,
        details: {
          uploadsDir: stats ? 'accessible' : 'not found',
          writeTest: 'passed',
          readTest: 'passed'
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  async checkExternalAPIs() {
    const apis = [];
    
    // Check OpenAI API
    if (process.env.OPENAI_API_KEY) {
      try {
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }
        });
        apis.push({
          name: 'OpenAI',
          status: response.ok ? 'healthy' : 'degraded',
          responseTime: response.headers.get('cf-ray') ? 'fast' : 'normal'
        });
      } catch (error) {
        apis.push({
          name: 'OpenAI',
          status: 'unhealthy',
          error: error.message
        });
      }
    }

    // Check Stripe API
    if (process.env.STRIPE_SECRET_KEY) {
      try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        await stripe.accounts.retrieve();
        apis.push({
          name: 'Stripe',
          status: 'healthy'
        });
      } catch (error) {
        apis.push({
          name: 'Stripe',
          status: 'unhealthy',
          error: error.message
        });
      }
    }

    const overallStatus = apis.every(api => api.status === 'healthy') ? 'healthy' :
                         apis.some(api => api.status === 'healthy') ? 'degraded' : 'unhealthy';

    return {
      status: overallStatus,
      apis,
      details: {
        totalAPIs: apis.length,
        healthyAPIs: apis.filter(api => api.status === 'healthy').length
      }
    };
  }

  async getSystemMetrics() {
    // Memory usage
    const memUsage = process.memoryUsage();
    this.metrics.memoryUsage = {
      rss: memUsage.rss,
      heapTotal: memUsage.heapTotal,
      heapUsed: memUsage.heapUsed,
      external: memUsage.external,
      percentUsed: (memUsage.heapUsed / memUsage.heapTotal) * 100
    };

    // CPU usage
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (let type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    this.metrics.cpuUsage = ((totalTick - totalIdle) / totalTick) * 100;

    // System load
    this.metrics.systemLoad = os.loadavg();

    // Disk usage
    this.metrics.diskUsage = await this.getDiskUsage();

    return this.metrics;
  }

  async getDiskUsage() {
    try {
      const stats = await fs.stat(process.cwd());
      // This is a simplified approach - in production, you'd want to use statvfs or similar
      return {
        total: 'unknown',
        free: 'unknown',
        used: 'unknown',
        percentUsed: 0
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  parseRedisInfo(info) {
    const lines = info.split('\r\n');
    const memory = {};
    
    lines.forEach(line => {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        if (key.includes('memory')) {
          memory[key] = value;
        }
      }
    });
    
    return memory;
  }

  async runHealthCheck() {
    const results = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      services: {},
      metrics: await this.getSystemMetrics(),
      uptime: Date.now() - this.metrics.startTime,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    };

    // Check all services
    const serviceChecks = Array.from(this.services.entries()).map(async ([key, service]) => {
      try {
        const result = await service.check();
        results.services[key] = {
          name: service.name,
          type: service.type,
          critical: service.critical,
          ...result
        };
      } catch (error) {
        results.services[key] = {
          name: service.name,
          type: service.type,
          critical: service.critical,
          status: 'unhealthy',
          error: error.message
        };
      }
    });

    await Promise.all(serviceChecks);

    // Determine overall status
    const criticalServices = Object.values(results.services).filter(s => s.critical);
    const unhealthyCritical = criticalServices.filter(s => s.status === 'unhealthy');
    const degradedServices = Object.values(results.services).filter(s => s.status === 'degraded');

    if (unhealthyCritical.length > 0) {
      results.status = 'unhealthy';
    } else if (degradedServices.length > 0) {
      results.status = 'degraded';
    }

    // Check system thresholds
    await this.checkThresholds(results);

    return results;
  }

  async checkThresholds(results) {
    const alerts = [];

    // Memory threshold
    if (results.metrics.memoryUsage.percentUsed > this.config.thresholds.memoryUsage * 100) {
      alerts.push({
        type: 'memory',
        severity: 'warning',
        message: `Memory usage at ${results.metrics.memoryUsage.percentUsed.toFixed(1)}%`
      });
    }

    // CPU threshold
    if (results.metrics.cpuUsage > this.config.thresholds.cpuUsage * 100) {
      alerts.push({
        type: 'cpu',
        severity: 'warning',
        message: `CPU usage at ${results.metrics.cpuUsage.toFixed(1)}%`
      });
    }

    // Error rate threshold
    const errorRate = this.metrics.requestCount > 0 ? 
      this.metrics.errorCount / this.metrics.requestCount : 0;
    
    if (errorRate > this.config.thresholds.errorRate) {
      alerts.push({
        type: 'errors',
        severity: 'critical',
        message: `Error rate at ${(errorRate * 100).toFixed(1)}%`
      });
    }

    // Process alerts
    for (const alert of alerts) {
      await this.processAlert(alert);
    }

    results.alerts = alerts;
  }

  async processAlert(alert) {
    const alertKey = `${alert.type}_${alert.severity}`;
    const lastAlert = this.alerts.get(alertKey);
    
    // Check cooldown period
    if (lastAlert && Date.now() - lastAlert < this.config.alertCooldown) {
      return;
    }

    this.alerts.set(alertKey, Date.now());

    // Log alert
    console.error(`🚨 ALERT [${alert.severity.toUpperCase()}]: ${alert.message}`);

    // In production, you would send to external alerting systems
    // await this.sendToSlack(alert);
    // await this.sendToEmail(alert);
    // await this.sendToPagerDuty(alert);
  }

  startMonitoring() {
    // Periodic health checks
    const healthCheckInterval = setInterval(async () => {
      try {
        await this.runHealthCheck();
      } catch (error) {
        console.error('Health check failed:', error);
      }
    }, this.config.checkInterval);

    this.checkIntervals.set('health', healthCheckInterval);

    // Metrics collection
    const metricsInterval = setInterval(() => {
      this.getSystemMetrics();
    }, 10000); // Every 10 seconds

    this.checkIntervals.set('metrics', metricsInterval);

    console.log('✅ Health monitoring started');
  }

  stopMonitoring() {
    for (const [name, interval] of this.checkIntervals) {
      clearInterval(interval);
    }
    this.checkIntervals.clear();
    console.log('⏹️ Health monitoring stopped');
  }

  // Express middleware for tracking requests
  requestMiddleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      this.metrics.requestCount++;
      this.metrics.activeConnections++;

      // Track response
      const originalSend = res.send;
      res.send = function(data) {
        const responseTime = Date.now() - startTime;
        
        // Update metrics
        healthMonitor.metrics.responseTimesMS.push(responseTime);
        if (healthMonitor.metrics.responseTimesMS.length > 1000) {
          healthMonitor.metrics.responseTimesMS = healthMonitor.metrics.responseTimesMS.slice(-500);
        }

        if (res.statusCode >= 400) {
          healthMonitor.metrics.errorCount++;
        }

        healthMonitor.metrics.activeConnections--;
        
        return originalSend.call(this, data);
      };

      next();
    };
  }

  // Get health status for API endpoint
  getStatus() {
    return this.runHealthCheck();
  }

  // Get metrics summary
  getMetricsSummary() {
    const responseTimes = this.metrics.responseTimesMS;
    const avgResponseTime = responseTimes.length > 0 ? 
      responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0;

    return {
      uptime: Date.now() - this.metrics.startTime,
      requests: {
        total: this.metrics.requestCount,
        errors: this.metrics.errorCount,
        errorRate: this.metrics.requestCount > 0 ? 
          this.metrics.errorCount / this.metrics.requestCount : 0,
        averageResponseTime: Math.round(avgResponseTime)
      },
      system: {
        memory: this.metrics.memoryUsage,
        cpu: this.metrics.cpuUsage,
        load: this.metrics.systemLoad,
        activeConnections: this.metrics.activeConnections
      },
      timestamp: new Date().toISOString()
    };
  }
}

// Singleton instance
const healthMonitor = new HealthMonitor();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n📊 Health monitoring shutting down gracefully...');
  healthMonitor.stopMonitoring();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n📊 Health monitoring shutting down gracefully...');
  healthMonitor.stopMonitoring();
  process.exit(0);
});

module.exports = healthMonitor;