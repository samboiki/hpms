# OneHealth - Deployment Guide

## 🚀 Production Deployment

### Prerequisites
- Node.js 18+ installed
- Supabase account and project
- Vercel account (recommended) or your preferred hosting platform
- Domain name (optional)

### Step 1: Database Setup

1. **Create Supabase Project**
   ```bash
   # Go to https://supabase.com
   # Create a new project
   # Note down your project URL and API keys
   ```

2. **Apply Database Migrations**
   ```bash
   # Install Supabase CLI if not already installed
   npm install -g supabase
   
   # Initialize Supabase in your project
   supabase init
   
   # Link to your Supabase project
   supabase link --project-ref YOUR_PROJECT_REF
   
   # Apply migrations
   supabase db push
   ```

3. **Verify Database Setup**
   - Check that all tables are created
   - Verify RLS policies are active
   - Test sample data insertion

### Step 2: Environment Configuration

1. **Create Production Environment File**
   ```env
   # Production .env.local
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   NEXT_PUBLIC_APP_NAME=OneHealth
   NEXT_PUBLIC_APP_VERSION=1.0.0
   ```

2. **Configure Supabase Auth**
   - Set up email templates
   - Configure OAuth providers if needed
   - Set redirect URLs for your domain

### Step 3: Vercel Deployment

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Deploy to Vercel**
   ```bash
   # From your project root
   vercel
   
   # Follow the prompts:
   # - Link to existing project or create new
   # - Set build settings (Next.js detected automatically)
   # - Configure environment variables
   ```

3. **Configure Environment Variables in Vercel**
   ```bash
   # Via CLI
   vercel env add NEXT_PUBLIC_SUPABASE_URL
   vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
   vercel env add SUPABASE_SERVICE_ROLE_KEY
   vercel env add NEXT_PUBLIC_APP_NAME
   vercel env add NEXT_PUBLIC_APP_VERSION
   
   # Or via Vercel Dashboard:
   # Go to Project Settings > Environment Variables
   ```

4. **Deploy**
   ```bash
   vercel --prod
   ```

### Step 4: Custom Domain (Optional)

1. **Add Domain in Vercel**
   - Go to Project Settings > Domains
   - Add your custom domain
   - Configure DNS records as instructed

2. **Update Supabase Settings**
   - Add your production domain to allowed origins
   - Update redirect URLs for auth

### Step 5: Post-Deployment Setup

1. **Create Admin User**
   ```sql
   -- Run in Supabase SQL Editor
   INSERT INTO auth.users (
     instance_id,
     id,
     aud,
     role,
     email,
     encrypted_password,
     email_confirmed_at,
     created_at,
     updated_at,
     confirmation_token,
     email_change,
     email_change_token_new,
     recovery_token
   ) VALUES (
     '00000000-0000-0000-0000-000000000000',
     gen_random_uuid(),
     'authenticated',
     'authenticated',
     'admin@yourpractice.com',
     crypt('your-secure-password', gen_salt('bf')),
     NOW(),
     NOW(),
     NOW(),
     '',
     '',
     '',
     ''
   );
   
   -- Create user profile
   INSERT INTO user_profiles (
     id,
     first_name,
     last_name,
     email,
     role,
     display_name,
     is_active
   ) VALUES (
     (SELECT id FROM auth.users WHERE email = 'admin@yourpractice.com'),
     'System',
     'Admin',
     'admin@yourpractice.com',
     'admin',
     'System Admin',
     true
   );
   ```

2. **Setup First Practice**
   ```sql
   INSERT INTO practices (
     name,
     slug,
     description,
     email,
     phone,
     address_line_1,
     city,
     country,
     status
   ) VALUES (
     'Main Practice',
     'main-practice',
     'Primary practice location',
     'info@yourpractice.com',
     '+264 XX XXX XXXX',
     'Your Address',
     'Windhoek',
     'Namibia',
     'active'
   );
   ```

3. **Assign Admin to Practice**
   ```sql
   INSERT INTO user_practice_assignments (
     user_id,
     practice_id,
     role,
     is_primary,
     is_active
   ) VALUES (
     (SELECT id FROM auth.users WHERE email = 'admin@yourpractice.com'),
     (SELECT id FROM practices WHERE slug = 'main-practice'),
     'admin',
     true,
     true
   );
   ```

## 🔧 Alternative Deployment Options

### Docker Deployment

1. **Create Dockerfile**
   ```dockerfile
   FROM node:18-alpine AS dependencies
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   
   FROM node:18-alpine AS builder
   WORKDIR /app
   COPY . .
   COPY --from=dependencies /app/node_modules ./node_modules
   RUN npm run build
   
   FROM node:18-alpine AS runner
   WORKDIR /app
   ENV NODE_ENV production
   
   RUN addgroup -g 1001 -S nodejs
   RUN adduser -S nextjs -u 1001
   
   COPY --from=builder /app/public ./public
   COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
   COPY --from=builder /app/node_modules ./node_modules
   COPY --from=builder /app/package.json ./package.json
   
   USER nextjs
   EXPOSE 3000
   ENV PORT 3000
   
   CMD ["npm", "start"]
   ```

2. **Build and Run**
   ```bash
   docker build -t onehealth .
   docker run -p 3000:3000 onehealth
   ```

### Manual Server Deployment

1. **Prepare Server**
   ```bash
   # Install Node.js 18+
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Install PM2 for process management
   sudo npm install -g pm2
   ```

2. **Deploy Application**
   ```bash
   # Clone repository
   git clone https://github.com/your-username/onehealth.git
   cd onehealth
   
   # Install dependencies
   npm ci --only=production
   
   # Build application
   npm run build
   
   # Start with PM2
   pm2 start npm --name "onehealth" -- start
   pm2 save
   pm2 startup
   ```

3. **Configure Nginx (Optional)**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

## 🔒 Security Checklist

### Pre-Deployment Security

- [ ] All environment variables are properly secured
- [ ] Service role key is not exposed in client-side code
- [ ] RLS policies are enabled and tested
- [ ] API routes have proper authentication
- [ ] Input validation is implemented
- [ ] SQL injection prevention is in place

### Post-Deployment Security

- [ ] HTTPS is enabled (automatic with Vercel)
- [ ] Security headers are configured
- [ ] Database backups are automated
- [ ] Access logs are monitored
- [ ] User permissions are properly set
- [ ] Regular security updates are planned

## 📊 Monitoring & Maintenance

### Performance Monitoring

1. **Set up Vercel Analytics**
   ```bash
   npm install @vercel/analytics
   ```

2. **Configure Error Tracking**
   - Sentry integration for error monitoring
   - Custom logging for important events
   - Performance metrics tracking

### Database Maintenance

1. **Regular Backups**
   - Supabase handles automatic backups
   - Consider additional backup strategies
   - Test backup restoration procedures

2. **Performance Optimization**
   - Monitor query performance
   - Add indexes as needed
   - Regular database cleanup

### Updates and Patches

1. **Dependency Updates**
   ```bash
   # Check for updates
   npm outdated
   
   # Update dependencies
   npm update
   
   # Security audit
   npm audit
   ```

2. **Deployment Process**
   ```bash
   # Test changes locally
   npm run dev
   
   # Build and test
   npm run build
   
   # Deploy to staging first
   vercel --prod
   ```

## 🆘 Troubleshooting

### Common Issues

1. **Build Failures**
   - Check TypeScript errors: `npm run type-check`
   - Verify environment variables
   - Review dependency versions

2. **Database Connection Issues**
   - Verify Supabase URL and keys
   - Check network connectivity
   - Review RLS policies

3. **Authentication Problems**
   - Check redirect URLs
   - Verify email templates
   - Review user roles and permissions

### Support Resources

- **Documentation**: Comprehensive guides in `/docs`
- **Community**: Join our Discord server
- **Email Support**: support@onehealth.na
- **Phone Support**: +264 XX XXX XXXX

### Rollback Procedure

1. **Vercel Rollback**
   ```bash
   # List deployments
   vercel list
   
   # Promote previous deployment
   vercel promote [deployment-url]
   ```

2. **Database Rollback**
   ```bash
   # Use Supabase point-in-time recovery
   # Or restore from backup
   ```

---

**OneHealth Deployment Guide v1.0**

For the latest deployment information, visit our [documentation](https://docs.onehealth.na)