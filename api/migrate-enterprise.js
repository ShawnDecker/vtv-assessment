// Enterprise migration - creates multi-tenant tables and extensions
const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  const sql = neon(process.env.DATABASE_URL);

  try {
    // 1. Tenants table - churches and companies
    await sql`
      CREATE TABLE IF NOT EXISTS tenants (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('church', 'corporate')),
        slug TEXT UNIQUE NOT NULL,
        invite_code TEXT UNIQUE NOT NULL,
        tier TEXT NOT NULL DEFAULT 'starter' CHECK (tier IN ('starter', 'growth', 'pro', 'enterprise', 'integration')),
        logo_url TEXT,
        primary_color TEXT DEFAULT '#D4AF37',
        secondary_color TEXT DEFAULT '#1a1a2e',
        custom_domain TEXT,
        settings JSONB DEFAULT '{}',
        anonymity_threshold INTEGER DEFAULT 5,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // 2. Tenant admins - people who manage tenant dashboards
    await sql`
      CREATE TABLE IF NOT EXISTS tenant_admins (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id),
        email TEXT NOT NULL,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('owner', 'admin', 'viewer')),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        last_login TIMESTAMPTZ,
        UNIQUE(tenant_id, email)
      )
    `;

    // 3. Tenant members - link contacts to tenants with metadata
    await sql`
      CREATE TABLE IF NOT EXISTS tenant_members (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id),
        contact_id INTEGER NOT NULL REFERENCES contacts(id),
        department TEXT,
        campus TEXT,
        small_group TEXT,
        ministry TEXT,
        employee_id TEXT,
        role_title TEXT,
        custom_fields JSONB DEFAULT '{}',
        joined_at TIMESTAMPTZ DEFAULT NOW(),
        is_active BOOLEAN DEFAULT true,
        UNIQUE(tenant_id, contact_id)
      )
    `;

    // 4. Tenant invites - track invite links
    await sql`
      CREATE TABLE IF NOT EXISTS tenant_invites (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id),
        code TEXT UNIQUE NOT NULL,
        created_by INTEGER REFERENCES tenant_admins(id),
        max_uses INTEGER,
        use_count INTEGER DEFAULT 0,
        department TEXT,
        campus TEXT,
        expires_at TIMESTAMPTZ,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // 5. Training paths - configurable training tracks
    await sql`
      CREATE TABLE IF NOT EXISTS training_paths (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id),
        name TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL CHECK (type IN ('corporate', 'church', 'universal')),
        category TEXT NOT NULL,
        pillar TEXT,
        score_min INTEGER,
        score_max INTEGER,
        content JSONB NOT NULL DEFAULT '[]',
        is_active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // 6. Training assignments - track who is assigned what
    await sql`
      CREATE TABLE IF NOT EXISTS training_assignments (
        id SERIAL PRIMARY KEY,
        contact_id INTEGER NOT NULL REFERENCES contacts(id),
        training_path_id INTEGER NOT NULL REFERENCES training_paths(id),
        assessment_id INTEGER REFERENCES assessments(id),
        tenant_id INTEGER REFERENCES tenants(id),
        status TEXT DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'completed', 'skipped')),
        progress INTEGER DEFAULT 0,
        assigned_at TIMESTAMPTZ DEFAULT NOW(),
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        UNIQUE(contact_id, training_path_id, assessment_id)
      )
    `;

    // 7. Wealth triggers - score-based advanced pathway triggers
    await sql`
      CREATE TABLE IF NOT EXISTS wealth_triggers (
        id SERIAL PRIMARY KEY,
        contact_id INTEGER NOT NULL REFERENCES contacts(id),
        assessment_id INTEGER NOT NULL REFERENCES assessments(id),
        trigger_type TEXT NOT NULL,
        trigger_reason TEXT NOT NULL,
        pathway TEXT NOT NULL,
        status TEXT DEFAULT 'triggered' CHECK (status IN ('triggered', 'engaged', 'completed', 'dismissed')),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // 8. CSV imports tracking
    await sql`
      CREATE TABLE IF NOT EXISTS csv_imports (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id),
        admin_id INTEGER NOT NULL REFERENCES tenant_admins(id),
        filename TEXT NOT NULL,
        row_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        errors JSONB DEFAULT '[]',
        column_mapping JSONB NOT NULL DEFAULT '{}',
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      )
    `;

    // 9. Dashboard alerts
    await sql`
      CREATE TABLE IF NOT EXISTS dashboard_alerts (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id),
        alert_type TEXT NOT NULL,
        severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // 10. Add tenant_id to assessments for tenant-scoped queries
    try {
      await sql`ALTER TABLE assessments ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id)`;
    } catch (e) { /* column may already exist */ }

    // 11. Add tenant_id to contacts
    try {
      await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id)`;
    } catch (e) { /* column may already exist */ }

    // 12. Add overlay_type columns to assessments for church/corporate overlays
    try {
      await sql`ALTER TABLE assessments ADD COLUMN IF NOT EXISTS church_overlay_scores JSONB`;
      await sql`ALTER TABLE assessments ADD COLUMN IF NOT EXISTS corporate_overlay_scores JSONB`;
      await sql`ALTER TABLE assessments ADD COLUMN IF NOT EXISTS training_recommendations JSONB`;
      await sql`ALTER TABLE assessments ADD COLUMN IF NOT EXISTS wealth_triggers_data JSONB`;
    } catch (e) { /* columns may already exist */ }

    // Create indexes for performance
    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant ON tenant_members(tenant_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_tenant_members_contact ON tenant_members(contact_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_assessments_tenant ON assessments(tenant_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_training_assignments_contact ON training_assignments(contact_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_training_assignments_tenant ON training_assignments(tenant_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_wealth_triggers_contact ON wealth_triggers(contact_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_dashboard_alerts_tenant ON dashboard_alerts(tenant_id)`;
    } catch (e) { /* indexes may already exist */ }

    res.json({
      success: true,
      message: 'Enterprise migration completed successfully',
      tables: [
        'tenants', 'tenant_admins', 'tenant_members', 'tenant_invites',
        'training_paths', 'training_assignments', 'wealth_triggers',
        'csv_imports', 'dashboard_alerts'
      ],
      columns_added: [
        'assessments.tenant_id', 'assessments.church_overlay_scores',
        'assessments.corporate_overlay_scores', 'assessments.training_recommendations',
        'assessments.wealth_triggers_data', 'contacts.tenant_id'
      ]
    });
  } catch (err) {
    console.error('Enterprise migration error:', err);
    res.status(500).json({ error: err.message });
  }
};
