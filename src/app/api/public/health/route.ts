// src/app/api/public/health/route.ts
import { NextResponse } from 'next/server'

/**
 * @swagger
 * /api/public/health:
 *   get:
 *     summary: Health check endpoint
 *     description: Simple health check endpoint that returns the service status and current timestamp. Used for monitoring and uptime checks.
 *     tags:
 *       - Public - Health
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   description: Current server timestamp in ISO 8601 format
 *                   example: 2024-01-15T10:30:00.000Z
 *                 service:
 *                   type: string
 *                   example: pathology-bites-api
 */
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'pathology-bites-api'
  })
}
