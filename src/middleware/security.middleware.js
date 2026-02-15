import { slidingWindow } from '@arcjet/node';
import aj from '../config/arcjet.js';
import logger from '../config/logger.js';

const securityMiddleware = async (req, res, next) => {
  try {
    const role = req.user?.role || 'guest';

    let limit;

    switch (role) {
      case 'admin':
        limit = 20;
        console.log('Admin rate limit exceeded');
        break;
      case 'user':
        limit = 10;
        console.log('User rate limit exceeded');
        break;
      case 'guest':
        limit = 5;
        console.log('Guest rate limit exceeded');
        break;
    }

    const client = aj.withRule(
      slidingWindow({
        mode: 'LIVE',
        interval: '1m',
        max: limit,
        name: `${role}-rate-limit`,
      })
    );

    const decision = await client.protect(req);

    if (decision.isDenied() && decision.reason.isBot()) {
      logger.warn('Bot request blocked', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
      });
      res.status(403).json({
        error: 'Forbidden',
        message: 'Your request has been blocked by security measures',
      });
    }
    if (decision.isDenied() && decision.reason.isShield()) {
      logger.warn('Shield blocked request', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method,
      });
      res.status(403).json({
        error: 'Forbidden',
        message: 'Your request has been blocked by security measures',
      });
    }
    if (decision.isDenied() && decision.reason.isRateLimit()) {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
      });
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'You have exceeded your rate limit',
      });
    }
    next();
  } catch (e) {
    console.log('Arject middleware error: ,', e);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Something went wrong with the security middleware',
    });
  }
};

export default securityMiddleware;
