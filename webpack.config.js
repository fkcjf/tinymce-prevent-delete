const path = require('path');

module.exports = [
	{
		mode: 'development',
		name: 'development',
		devtool: 'inline-source-map',
		entry: {
			filename: path.resolve(__dirname, 'src', 'index.js'),
		},
		output: {
			path: path.resolve(__dirname, 'dist', 'preventdelete'),
			filename: 'plugin.js',
			libraryTarget: 'umd',
		},
	},
	{
		mode: 'production',
		name: 'production',
		devtool: false,
		entry: {
			filename: path.resolve(__dirname, 'src', 'index.js'),
		},
		output: {
			path: path.resolve(__dirname, 'dist', 'preventdelete'),
			filename: 'plugin.min.js',
			libraryTarget: 'umd',
		},
	},
];
