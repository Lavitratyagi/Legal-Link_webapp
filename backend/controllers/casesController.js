const Case = require('../models/Case');

exports.createCase = async (req, res) => {
  try {
    const { title, caseType, clientName, description } = req.body;
    
    const newCase = new Case({
      title,
      caseType,
      clientName,
      name: clientName || 'N/A', 
      phone: 'N/A',              
      city: 'N/A',               
      description,
      lawyerId: req.user._id,
      status: 'pending'
    });
    
    const saved = await newCase.save();
    return res.status(201).json({ success: true, case: saved });
  } catch (error) {
    console.error('createCase error:', error);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.getMyCases = async (req, res) => {
  try {
    const cases = await Case.find({ lawyerId: req.user._id }).sort({ createdAt: -1 });
    
    // Additional stats calculation mimicking original payload format
    let active = 0, resolved = 0, urgent = 0;
    cases.forEach(c => {
      if (c.status === 'resolved') resolved++;
      else active++;
      if (c.urgency === 'urgent' || c.urgency === 'emergency') urgent++;
    });

    return res.json({ 
      success: true, 
      cases,
      stats: { total: cases.length, active, resolved, urgent }
    });
  } catch (err) {
    console.error('getMyCases error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.getCaseById = async (req, res) => {
  try {
    const { id } = req.params;
    const c = await Case.findById(id);
    if (!c) return res.status(404).json({ success: false, message: 'Case not found' });
    
    // Safety check: only the lawyer assigned to this case should view it
    if (c.lawyerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    return res.json({ success: true, case: c });
  } catch (err) {
    console.error('getCaseById error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
