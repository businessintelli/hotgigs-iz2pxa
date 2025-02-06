/** 
 * PostCSS Configuration
 * Version: 1.0.0
 * 
 * Configures the CSS processing pipeline for the HotGigs application
 * Integrates Tailwind CSS and other PostCSS plugins for optimal styling
 */

module.exports = {
  plugins: [
    // postcss-import v15.1.0
    // Handle CSS @import statements and resolve dependencies
    require('postcss-import')(),

    // tailwindcss v3.3.0
    // Process Tailwind CSS utilities and components
    require('tailwindcss')(),

    // autoprefixer v10.4.14
    // Add vendor prefixes for browser compatibility
    require('autoprefixer')()
  ]
};