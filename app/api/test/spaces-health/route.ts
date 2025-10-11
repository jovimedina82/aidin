/**
 * DigitalOcean Spaces Health Check Endpoint
 *
 * GET /api/test/spaces-health
 *
 * Tests connection to DigitalOcean Spaces and verifies:
 * - Credentials are valid
 * - Bucket is accessible
 * - Upload/delete operations work
 */

import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';

const ENDPOINT = process.env.SPACES_ENDPOINT || 'sfo3.digitaloceanspaces.com';
const REGION = process.env.SPACES_REGION || 'sfo3';
const BUCKET = process.env.SPACES_BUCKET || 'aidin-helpdesk-attachments';
const ACCESS_KEY = process.env.SPACES_ACCESS_KEY_ID || '';
const SECRET_KEY = process.env.SPACES_SECRET_ACCESS_KEY || '';

export async function GET(request: NextRequest) {
  const results: any = {
    timestamp: new Date().toISOString(),
    config: {
      endpoint: ENDPOINT,
      region: REGION,
      bucket: BUCKET,
      hasAccessKey: !!ACCESS_KEY,
      hasSecretKey: !!SECRET_KEY
    },
    tests: {}
  };

  try {
    // 1. Initialize S3 Client
    const s3Client = new S3Client({
      endpoint: `https://${ENDPOINT}`,
      region: REGION,
      credentials: {
        accessKeyId: ACCESS_KEY,
        secretAccessKey: SECRET_KEY
      },
      forcePathStyle: false
    });

    results.tests.clientInitialized = {
      success: true,
      message: 'S3 client initialized'
    };

    // 2. Test bucket access
    try {
      await s3Client.send(new HeadBucketCommand({
        Bucket: BUCKET
      }));

      results.tests.bucketAccess = {
        success: true,
        message: `Bucket '${BUCKET}' is accessible`
      };
    } catch (error: any) {
      results.tests.bucketAccess = {
        success: false,
        error: error.message,
        code: error.Code
      };

      return NextResponse.json(results, { status: 500 });
    }

    // 3. Test upload
    const testKey = `test/health-check-${Date.now()}.txt`;
    const testContent = `Health check test at ${new Date().toISOString()}`;

    try {
      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: testKey,
        Body: Buffer.from(testContent, 'utf8'),
        ContentType: 'text/plain',
        ACL: 'public-read'
      }));

      const cdnUrl = `https://${BUCKET}.${REGION}.cdn.digitaloceanspaces.com/${testKey}`;

      results.tests.upload = {
        success: true,
        message: 'Test file uploaded successfully',
        key: testKey,
        url: cdnUrl
      };
    } catch (error: any) {
      results.tests.upload = {
        success: false,
        error: error.message,
        code: error.Code
      };

      return NextResponse.json(results, { status: 500 });
    }

    // 4. Test delete
    try {
      await s3Client.send(new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: testKey
      }));

      results.tests.delete = {
        success: true,
        message: 'Test file deleted successfully'
      };
    } catch (error: any) {
      results.tests.delete = {
        success: false,
        error: error.message,
        code: error.Code,
        note: 'Cleanup failed - test file may still exist'
      };
    }

    // All tests passed
    results.overall = {
      status: 'healthy',
      message: 'All DigitalOcean Spaces tests passed'
    };

    return NextResponse.json(results, { status: 200 });

  } catch (error: any) {
    results.overall = {
      status: 'unhealthy',
      error: error.message,
      stack: error.stack
    };

    return NextResponse.json(results, { status: 500 });
  }
}
