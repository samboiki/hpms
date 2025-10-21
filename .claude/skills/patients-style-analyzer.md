# Patients Portal Style Analyzer Skill

## Purpose
This skill analyzes the style patterns, components, and design system used in the Patients portal (http://localhost:7000/patients) to ensure consistency across the application.

## Style Patterns to Extract

### 1. Layout & Structure
- **Background Pattern**: Grey dotted grid pattern
  ```css
  backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.1) 1px, transparent 0)'
  backgroundSize: '20px 20px'
  ```
- **Container Padding**: `px-0 sm:px-4 md:px-6 py-4 md:py-6`
- **Card Styling**: White background with backdrop blur, rounded corners, shadow
- **Spacing**: `space-y-4 md:space-y-6`

### 2. Color Palette
- **Primary Gradient**: `from-purple-500 to-indigo-600`
- **Secondary Gradient**: `from-gray-50 to-gray-100/30`
- **Text Colors**:
  - Primary: `text-gray-800`
  - Secondary: `text-gray-500`
  - Muted: `text-gray-400`
- **Active Status**: `bg-green-500`
- **Inactive Status**: `bg-gray-400`

### 3. Icon System
- **Library**: Solar Icons (Bold Duotone)
- **Common Icons**:
  - Users: `solar:users-group-two-rounded-bold-duotone`
  - Settings: `solar:settings-minimalistic-bold-duotone`
  - Search: `solar:magnifer-bold-duotone`
  - Add: `solar:add-circle-bold-duotone`
  - Chart: `solar:chart-square-bold-duotone`
- **Sizes**: `w-4 h-4`, `w-5 h-5`, `w-8 h-8`

### 4. Filter Components
- **Filter Pills Container**: `flex items-center gap-1 bg-gray-100 rounded-lg p-1`
- **Active Pill**: `px-3 py-1.5 rounded-md text-sm font-medium bg-white text-purple-600 shadow-sm`
- **Inactive Pill**: `px-3 py-1.5 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900`
- **Filter Groups**: Multiple pill groups with icons
- **Status Indicators**: Colored dots (`w-2 h-2 rounded-full`)

### 5. Search Bar
- **Container**: Gradient border effect on hover
- **Input**: `bg-gray-200 rounded-xl` with `pl-12` for icon
- **Icon Position**: `absolute left-4 top-1/2 -translate-y-1/2`
- **Hover Effect**: Shimmer animation with gradient overlay
- **Placeholder**: Descriptive text with context

### 6. Action Buttons
- **Primary Button**:
  - Gradient: `bg-gradient-to-r from-purple-500 to-indigo-600`
  - Text: `text-white`
  - Padding: `px-4 py-2.5` or `px-6 py-3`
  - Border Radius: `rounded-lg` or `rounded-xl`
  - Shadow: `hover:shadow-lg`
  - Icon + Text layout
- **Secondary Button**: `bg-gray-100 text-gray-600 hover:bg-gray-200`
- **Icon Button**: `p-3 rounded-xl hover:bg-gray-100`

### 7. View Toggle
- **Container**: `flex items-center bg-gray-100 rounded-lg p-1`
- **Active View**: `bg-white text-purple-600 shadow-sm`
- **Inactive View**: `text-gray-600 hover:text-gray-900`
- **Icons**: List view and Grid view icons

### 8. Table/List View
- **Table Headers**: Bold, uppercase, smaller font
- **Table Rows**: Hover effect, zebra striping optional
- **Cell Padding**: `px-4 py-3`
- **Row Actions**: Icon buttons on hover

### 9. Statistics Cards
- **Layout**: Grid with responsive columns
- **Card Style**: White background, border, rounded-xl
- **Icon Container**: Gradient background, rounded-lg
- **Badge**: `bg-gray-100 rounded-full text-xs`
- **Hover**: Scale and shadow effects
- **Animation**: Framer Motion with delays

### 10. Modal/Dropdown
- **Backdrop**: `bg-black/20 backdrop-blur-sm`
- **Portal**: Using `createPortal` for z-index control
- **Modal**: `rounded-2xl shadow-2xl`
- **Header**: Gradient background
- **Content**: Structured sections with icons

### 11. Responsive Design
- **Mobile**: `lg:hidden` for mobile-specific elements
- **Desktop**: `hidden lg:block` for desktop-only
- **Breakpoints**: sm (640px), md (768px), lg (1024px)
- **Flex Direction**: `flex-col lg:flex-row`

### 12. Typography
- **Headings**:
  - H1: `text-2xl font-semibold`
  - H2: `text-xl font-bold`
  - H3: `text-lg font-medium`
- **Body**: `text-sm` or `text-base`
- **Labels**: `text-xs text-gray-500 font-medium`

### 13. Animations
- **Library**: Framer Motion
- **Tab Transitions**: `initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}`
- **Duration**: `0.3s` standard
- **Hover**: Scale 1.05, shadow increase
- **Loading**: Pulse animation

### 14. Form Inputs (Premium Style)
- **Container**: `bg-gradient-to-br from-gray-50 to-gray-100/30 rounded-xl border border-gray-200/50`
- **Input**: `bg-gray-200 hover:bg-gray-100 rounded-xl py-3.5 px-4`
- **Icon**: Left-aligned with `pl-12`
- **Focus**: `focus:ring-2 focus:ring-purple-500/30`

## Usage Instructions

When applying this style to new components:

1. **Always use Solar Bold Duotone icons**
2. **Apply the purple-indigo gradient for primary actions**
3. **Use the dotted background pattern for main pages**
4. **Maintain consistent spacing with Tailwind classes**
5. **Add hover effects and transitions for interactivity**
6. **Use Framer Motion for page transitions**
7. **Ensure responsive design with mobile-first approach**
8. **Apply proper z-index layers for modals/dropdowns**
9. **Use pill-style filters with bg-gray-100 containers**
10. **Add shimmer effects on search bars for premium feel**

## Component Checklist

When creating a new component matching this style:
- [ ] Uses Solar Bold Duotone icons
- [ ] Has purple-indigo gradient on primary buttons
- [ ] Includes hover states with shadow/scale effects
- [ ] Is fully responsive (mobile, tablet, desktop)
- [ ] Has smooth animations with Framer Motion
- [ ] Uses consistent spacing (4, 6 for gaps)
- [ ] Has proper text hierarchy
- [ ] Includes loading states
- [ ] Has proper focus states for accessibility
- [ ] Matches the color palette exactly
