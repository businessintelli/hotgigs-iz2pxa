-- Migration: Create Analytics Tables
-- Description: Sets up analytics schema with partitioned tables, materialized views, and security features

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create analytics schema
CREATE SCHEMA IF NOT EXISTS analytics;

-- Function to create new partitions automatically
CREATE OR REPLACE FUNCTION analytics.create_metrics_partition()
RETURNS TRIGGER AS $$
DECLARE
    partition_timestamp TIMESTAMP;
    partition_name TEXT;
BEGIN
    partition_timestamp := DATE_TRUNC('month', NEW.created_at);
    partition_name := 'metrics_' || TO_CHAR(partition_timestamp, 'YYYY_MM');
    
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = partition_name) THEN
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS analytics.%I PARTITION OF analytics.metrics 
            FOR VALUES FROM (%L) TO (%L)',
            partition_name,
            partition_timestamp,
            partition_timestamp + INTERVAL '1 month'
        );
        
        -- Create indexes on partition
        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS %I ON analytics.%I USING btree (metric_name, dimension)',
            'idx_' || partition_name || '_metric_dim',
            partition_name
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create metrics table with partitioning
CREATE TABLE IF NOT EXISTS analytics.metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name VARCHAR(255) NOT NULL,
    value NUMERIC NOT NULL,
    dimension VARCHAR(50) NOT NULL CHECK (dimension IN ('JOB_TYPE', 'DEPARTMENT', 'LOCATION', 'SOURCE', 'STAGE')),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    tenant_id UUID NOT NULL,
    created_by UUID NOT NULL
) PARTITION BY RANGE (created_at);

-- Create trigger for automatic partition creation
CREATE TRIGGER create_metrics_partition_trigger
    BEFORE INSERT ON analytics.metrics
    FOR EACH ROW
    EXECUTE FUNCTION analytics.create_metrics_partition();

-- Create BRIN index for time-series queries
CREATE INDEX idx_metrics_created_at ON analytics.metrics
    USING BRIN (created_at) WITH (pages_per_range = 32);

-- Create reports configuration table
CREATE TABLE IF NOT EXISTS analytics.reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('RECRUITMENT_FUNNEL', 'TIME_TO_HIRE', 'SOURCE_EFFECTIVENESS', 'INTERVIEWER_PERFORMANCE', 'CANDIDATE_PIPELINE')),
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY')),
    metrics TEXT[] NOT NULL,
    filters JSONB NOT NULL DEFAULT '{}',
    last_generated TIMESTAMPTZ,
    next_generation TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    tenant_id UUID NOT NULL,
    created_by UUID NOT NULL,
    CONSTRAINT valid_report_config CHECK (jsonb_typeof(filters) = 'object')
);

-- Create indexes for reports table
CREATE INDEX idx_reports_type_freq ON analytics.reports (type, frequency) WHERE is_active = true;
CREATE INDEX idx_reports_next_gen ON analytics.reports (next_generation) WHERE is_active = true;
CREATE INDEX idx_reports_search ON analytics.reports USING GIN (to_tsvector('english', report_name));

-- Create materialized view for dashboard statistics
CREATE MATERIALIZED VIEW analytics.dashboard_stats AS
WITH recruitment_metrics AS (
    SELECT 
        tenant_id,
        COUNT(DISTINCT CASE WHEN metric_name = 'total_jobs' THEN id END) as total_jobs,
        COUNT(DISTINCT CASE WHEN metric_name = 'active_candidates' THEN id END) as active_candidates,
        COUNT(DISTINCT CASE WHEN metric_name = 'scheduled_interviews' THEN id END) as scheduled_interviews,
        AVG(CASE WHEN metric_name = 'conversion_rate' THEN value END) as conversion_rate,
        AVG(CASE WHEN metric_name = 'time_to_hire' THEN value END) as time_to_hire
    FROM analytics.metrics
    WHERE created_at >= NOW() - INTERVAL '30 days'
    GROUP BY tenant_id
)
SELECT 
    uuid_generate_v4() as id,
    tenant_id,
    total_jobs,
    active_candidates,
    scheduled_interviews,
    ROUND(conversion_rate::numeric, 2) as conversion_rate,
    ROUND(time_to_hire::numeric, 2) as time_to_hire,
    now() as last_updated,
    '1 hour'::interval as update_frequency,
    false as is_stale
FROM recruitment_metrics;

-- Create unique index on materialized view
CREATE UNIQUE INDEX idx_dashboard_stats_tenant ON analytics.dashboard_stats (tenant_id);

-- Create function for refreshing dashboard stats
CREATE OR REPLACE FUNCTION analytics.refresh_dashboard_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.dashboard_stats;
END;
$$ LANGUAGE plpgsql;

-- Create RLS policies
ALTER TABLE analytics.metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.reports ENABLE ROW LEVEL SECURITY;
ALTER MATERIALIZED VIEW analytics.dashboard_stats ENABLE ROW LEVEL SECURITY;

-- Create policies for metrics
CREATE POLICY metrics_tenant_isolation ON analytics.metrics
    FOR ALL
    TO authenticated
    USING (tenant_id = auth.jwt() ->> 'tenant_id'::text);

-- Create policies for reports
CREATE POLICY reports_tenant_isolation ON analytics.reports
    FOR ALL
    TO authenticated
    USING (tenant_id = auth.jwt() ->> 'tenant_id'::text);

-- Create policies for dashboard stats
CREATE POLICY dashboard_stats_tenant_isolation ON analytics.dashboard_stats
    FOR ALL
    TO authenticated
    USING (tenant_id = auth.jwt() ->> 'tenant_id'::text);

-- Create cleanup function for old partitions
CREATE OR REPLACE FUNCTION analytics.cleanup_old_partitions()
RETURNS void AS $$
DECLARE
    partition_name text;
BEGIN
    FOR partition_name IN
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'analytics' 
        AND tablename LIKE 'metrics_%'
        AND to_timestamp(split_part(tablename, '_', 2) || split_part(tablename, '_', 3), 'YYYYMM') 
            < NOW() - INTERVAL '24 months'
    LOOP
        EXECUTE format('DROP TABLE IF EXISTS analytics.%I', partition_name);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create function for automatic updates
CREATE OR REPLACE FUNCTION analytics.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for timestamp updates
CREATE TRIGGER update_metrics_timestamp
    BEFORE UPDATE ON analytics.metrics
    FOR EACH ROW
    EXECUTE FUNCTION analytics.update_timestamp();

CREATE TRIGGER update_reports_timestamp
    BEFORE UPDATE ON analytics.reports
    FOR EACH ROW
    EXECUTE FUNCTION analytics.update_timestamp();

-- Create index for metrics querying
CREATE INDEX idx_metrics_composite ON analytics.metrics 
    USING btree (metric_name, dimension, created_at DESC);

-- Comments for documentation
COMMENT ON SCHEMA analytics IS 'Schema for analytics-related tables and functions';
COMMENT ON TABLE analytics.metrics IS 'Partitioned table storing all analytics metrics';
COMMENT ON TABLE analytics.reports IS 'Configuration table for analytics reports';
COMMENT ON MATERIALIZED VIEW analytics.dashboard_stats IS 'Materialized view for dashboard statistics with hourly refresh';

-- Version tracking
INSERT INTO public.schema_migrations (version, inserted_at)
VALUES ('00006', CURRENT_TIMESTAMP);