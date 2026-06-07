const jwt  = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Protect routes — reads JWT from HttpOnly cookie.
 * Attaches req.user on success.
 */
async function protect(req, res, next) {
  try {
    const token = req.cookies.nexacore_token;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authenticated. Please log in.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'User no longer exists.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired session. Please log in again.' });
  }
}

/**
 * CSRF protection — checks that the _csrf cookie value
 * matches the x-csrf-token request header.
 */
function csrfProtect(req, res, next) {
  // Skip for GET/HEAD/OPTIONS (safe methods)
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const cookieToken  = req.cookies._csrf;
  const headerToken  = req.headers['x-csrf-token'];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ success: false, message: 'CSRF validation failed.' });
  }
  next();
}

module.exports = { protect, csrfProtect };
