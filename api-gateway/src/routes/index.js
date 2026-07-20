import express from "express";
import {verifyJWT} from '../middlewares/auth.middleware.js';
import { createProxy, getCircuitBreakerStatus } from'../services/proxy.js';
import { ipRateLimit, endpointRateLimit, combinedRateLimit } from '../middlewares/rateLimiting.middleware.js';
import { config } from '../config/index.js';

const router = express.Router();

// ===========================
// Service Proxy Routes
// ===========================

/**
 * USER SERVICE ROUTES
 * Gateway Path: http://localhost:4000/api/users/auth/login
 * Service Path: /auth/login
**/

const userServiceProxy = createProxy('userService', config.SERVICES.USER_SERVICE_URL);

// public routes
router.post(
     '/users/auth/send-otp',
     endpointRateLimit(5, 3600000), // 5 requests per hour
     userServiceProxy
);

router.post(
     '/users/auth/verify-otp',
     endpointRateLimit(10, 3600000), // 10 requests per hour
     userServiceProxy
);

router.post(
     '/users/auth/login',
     endpointRateLimit(100, 900000),// 100 requests per 15 minutes
     userServiceProxy
);



router.post(
     '/users/auth/refresh',
     endpointRateLimit(20, 900000), // 20 requests per 15 minutes
     userServiceProxy
);

// private routes
router.get(
     '/users/user/get-profile',
     verifyJWT,
     combinedRateLimit(),
     userServiceProxy
)

/**
 * ADMIN SERVICE ROUTES
 * Gateway Path: http://localhost:4003/api/admins/stations/station
 * Service Path: /stations/station
**/
const adminServiceProxy = createProxy('adminService', config.SERVICES.ADMIN_SERVICE_URL);

router.post(
     '/admins/stations/station',
     verifyJWT,
     combinedRateLimit(),
     adminServiceProxy
);

router.post(
     '/admins/trains/train',
     verifyJWT,
     combinedRateLimit(),
     adminServiceProxy
);

router.get(
     '/admins/trains/train/:trainId',
     verifyJWT,
      combinedRateLimit(),
     adminServiceProxy
);

router.post(
     '/admins/trains/route',
     verifyJWT,
     combinedRateLimit(),
     adminServiceProxy
)

router.post(
     '/admins/schedules/schedule',
     verifyJWT,
     combinedRateLimit(),
     adminServiceProxy
)

router.put(
     '/admins/schedules/schedule/:scheduleId',
     verifyJWT,
     combinedRateLimit(),
     adminServiceProxy
)


// ===========================
// SEARCH SERVICE ROUTES (public - no auth required)
// ===========================
const searchServiceProxy = createProxy('searchService', config.SERVICES.SEARCH_SERVICE_URL);

router.get(
     '/search/trains',
     endpointRateLimit(60, 60000), // 60 requests per minute
     searchServiceProxy
);

router.get(
     '/search/autocomplete',
     endpointRateLimit(120, 60000), // 120 requests per minute
     searchServiceProxy
);




// Gateway Health Status

router.get('/gateway/health', (req, res) => {
     res.status(200).json({
          success: true,
          message: "API Gateway is healthy",
          timestamp: new Date().toISOString()
     });
});

router.get('/gateway/circuit-breakers', (req, res) => {
     const status = getCircuitBreakerStatus();
     res.status(200).json({
          success: true,
          circuitBreakers: status,
     });
});

export default router;