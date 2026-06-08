const jwt = require('jsonwebtoken');
 
function adminAuth(req, res, next) {
  const token = req.cookies?.admin_token;
  if (!token) {
    return res.status(401).json({ success: false, message: 'Admin not authenticated.' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET + '_admin');
    if (decoded.role !== 'admin') throw new Error('Not admin');
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired admin session.' });
  }
}
 
module.exports = adminAuth;
 