// src/app/api/refresh/route.ts
// In serverless (Netlify/Vercel): writes to /tmp which is writable
// In local dev: writes to data/today.json
 
import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import https from 'https'
 
// /tmp is writable in all serverless environments; data/ is used locally
const TODAY_PATH = '/tmp/today.json'
