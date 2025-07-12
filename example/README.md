# PostgreSQL OpenTelemetry Instrumentation Example

This example demonstrates PostgreSQL instrumentation with OpenTelemetry, including automated Grafana dashboard provisioning.

## 🚀 Quick Start

```bash
# Start all services
docker-compose up --build -d

# Check status
docker-compose ps
```

## 📊 Automated Dashboard Setup

The Grafana dashboard is **automatically provisioned** when the container starts. No manual configuration required!

### What's Automatically Configured:

1. **Data Sources**:
   - **Prometheus**: `http://prometheus:9090` (for metrics)
   - **Zipkin**: `http://zipkin:9411` (for traces)

2. **Dashboard**: "PostgreSQL Instrumentation Metrics" with:
   - Database Query Duration (histogram)
   - Database Query Count (rate)
   - Database Connections (rate)
   - Query Complexity Distribution (pie chart)
   - Query Types Distribution (pie chart)
   - Database Operations Distribution (pie chart)

## 🌐 Access Points

| Service | URL | Description |
|---------|-----|-------------|
| **App** | http://localhost:3000 | Main application |
| **Grafana** | http://localhost:3001 | Dashboard (admin/admin) |
| **Prometheus** | http://localhost:9090 | Metrics server |
| **Zipkin** | http://localhost:9411 | Trace server |
| **Metrics** | http://localhost:9464/metrics | Raw Prometheus metrics |

## 📈 Dashboard Features

### Metrics Collected:

- **Database Operations**: Query duration, count, and complexity
- **Connection Metrics**: Connection establishment and duration
- **Query Analysis**: Type classification and complexity distribution
- **HTTP Metrics**: Request duration and status codes

### Dashboard Panels:

1. **Database Query Duration**: Average query execution time
2. **Database Query Count**: Queries per second rate
3. **Database Connections**: Connection rate
4. **Query Complexity**: Distribution by complexity level
5. **Query Types**: Distribution by operation type
6. **Database Operations**: Distribution by SQL operation

## 🔧 Configuration Files

### Grafana Provisioning:

- `grafana/provisioning/datasources/datasources.yml` - Data source configuration
- `grafana/provisioning/dashboards/dashboards.yml` - Dashboard provider configuration
- `grafana/provisioning/dashboards/grafana-dashboard.json` - Dashboard definition

### Prometheus:

- `prometheus.yml` - Prometheus configuration with app target

## 🐛 Troubleshooting

### Dashboard Not Loading:

1. Check Grafana logs: `docker-compose logs grafana`
2. Verify data sources are working in Grafana UI
3. Ensure Prometheus is scraping metrics: `curl http://localhost:9464/metrics`

### No Data in Dashboard:

1. Generate traffic: `curl http://localhost:3000/`
2. Check Prometheus targets: http://localhost:9090/targets
3. Verify metrics are being collected: `curl http://localhost:9464/metrics | grep db_`

### Data Sources Not Working:

1. Check service connectivity: `docker-compose ps`
2. Verify URLs in `grafana/provisioning/datasources/datasources.yml`
3. Check network connectivity between containers

## 📝 Manual Dashboard Import (Alternative)

If you prefer manual setup:

1. Open Grafana: http://localhost:3001 (admin/admin)
2. Add Prometheus data source: `http://prometheus:9090`
3. Add Zipkin data source: `http://zipkin:9411`
4. Import dashboard: `grafana-dashboard.json`

## 🔄 Updating Dashboard

To modify the dashboard:

1. Edit `grafana/provisioning/dashboards/grafana-dashboard.json`
2. Restart Grafana: `docker-compose restart grafana`
3. Changes are automatically applied

## 🧹 Cleanup

```bash
# Stop all services
docker-compose down

# Remove volumes (data will be lost)
docker-compose down -v
```
