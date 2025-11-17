import pool from '../config/database.js';

// Get all subscription plans
export const getPlans = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM subscription_planz ORDER BY amount ASC`
    );

    const plans = result.rows.map(plan => ({
      id: plan.id.toString(),
      name: plan.name,
      amount: parseFloat(plan.amount),
      currency: plan.currency,
      startDate: plan.start_date,
      endDate: plan.end_date,
      isActive: plan.is_active,
      description: plan.description,
      createdAt: plan.created_at
    }));

    res.json(plans);
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create new subscription plan
export const createPlan = async (req, res) => {
  try {
    const { name, amount, currency = 'UGX', startDate, endDate, description } = req.body;

    // Check if plan exists
    const existingPlan = await pool.query(
      `SELECT * FROM subscription_planz WHERE name = $1`,
      [name]
    );

    if (existingPlan.rows.length > 0) {
      return res.status(400).json({ error: 'Plan with this name already exists' });
    }

    // Create plan (inactive by default)
    const result = await pool.query(
      `INSERT INTO subscription_planz (name, amount, currency, start_date, end_date, description, is_active) 
       VALUES ($1, $2, $3, $4, $5, $6, false) 
       RETURNING *`,
      [name, amount, currency, startDate, endDate, description]
    );

    const newPlan = result.rows[0];

    res.status(201).json({
      plan: {
        id: newPlan.id.toString(),
        name: newPlan.name,
        amount: parseFloat(newPlan.amount),
        currency: newPlan.currency,
        startDate: newPlan.start_date,
        endDate: newPlan.end_date,
        isActive: newPlan.is_active,
        description: newPlan.description,
        createdAt: newPlan.created_at
      }
    });

  } catch (error) {
    console.error('Create plan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update subscription plan
export const updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, amount, currency, startDate, endDate, description, isActive } = req.body;

    const result = await pool.query(
      `UPDATE subscription_planz 
       SET name = $1, amount = $2, currency = $3, start_date = $4, end_date = $5, description = $6, is_active = $7
       WHERE id = $8 
       RETURNING *`,
      [name, amount, currency, startDate, endDate, description, isActive, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const updatedPlan = result.rows[0];

    res.json({
      plan: {
        id: updatedPlan.id.toString(),
        name: updatedPlan.name,
        amount: parseFloat(updatedPlan.amount),
        currency: updatedPlan.currency,
        startDate: updatedPlan.start_date,
        endDate: updatedPlan.end_date,
        isActive: updatedPlan.is_active,
        description: updatedPlan.description,
        createdAt: updatedPlan.created_at
      }
    });

  } catch (error) {
    console.error('Update plan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Toggle plan activation
export const togglePlanActivation = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const result = await pool.query(
      `UPDATE subscription_planz 
       SET is_active = $1 
       WHERE id = $2 
       RETURNING *`,
      [isActive, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    res.json({ 
      success: true, 
      plan: result.rows[0],
      message: `Plan ${isActive ? 'activated' : 'deactivated'} successfully`
    });

  } catch (error) {
    console.error('Toggle plan activation error:', error);
    res.status(500).json({ error: 'Failed to update plan status' });
  }
};

// Delete subscription plan
export const deletePlan = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM subscription_planz WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    res.json({ message: 'Plan deleted successfully' });
  } catch (error) {
    console.error('Delete plan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};