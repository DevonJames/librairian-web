const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
	basePath: '',
	async rewrites() {
		return [
			{
				source: '/documents/api/:path*',
				destination: '/api/:path*',
			},
			{
				source: '/api/:path*',
				destination: '/api/:path*',
			},
		];
	},
	devIndicators: false,
	// Enable webpack alias for server module
	webpack: (config) => {
		config.resolve.alias['@server'] = path.join(__dirname, '../server');
		return config;
	},
	// Allow server-side file system operations
	experimental: {
		serverComponentsExternalPackages: ['fs', 'path', 'crypto'],
	},
};

module.exports = nextConfig;
