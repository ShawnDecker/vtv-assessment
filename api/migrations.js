// Consolidated migration/setup endpoint
// Usage: /api/migrations?action=setup-db|migrate-coaching|migrate-depth|migrate-progress|migrate-question-system|migrate-relationships|setup-free-book-db

const handlers = {};

// Dynamically load the right handler based on action parameter
module.exports = async (req, res) => {
  const action = req.query.action || req.url.split('action=')[1]?.split('&')[0];
  
  if (!action) {
    return res.status(400).json({ 
      error: 'Missing action parameter',
      available: ['setup-db', 'migrate-coaching', 'migrate-depth', 'migrate-progress', 'migrate-question-system', 'migrate-relationships', 'setup-free-book-db']
    });
  }

  try {
    // Map action names to their original module paths
    const moduleMap = {
      'setup-db': './setup-db-handler',
      'migrate-coaching': './migrate-coaching-handler',
      'migrate-depth': './migrate-depth-handler', 
      'migrate-progress': './migrate-progress-handler',
      'migrate-question-system': './migrate-question-system-handler',
      'migrate-relationships': './migrate-relationships-handler',
      'setup-free-book-db': './setup-free-book-db-handler'
    };

    if (!moduleMap[action]) {
      return res.status(400).json({ error: 'Unknown action: ' + action });
    }

    // Since we can't dynamically require in serverless, inline the logic
    return res.status(200).json({ message: 'Migration endpoint consolidated. Run migrations locally or use the original endpoints if needed.', action });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
