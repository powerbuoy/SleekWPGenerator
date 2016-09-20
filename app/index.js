// TODO: git submodule add https://github.com/powerbuoy/SleekWP sleek

/**
 * Lib
 */
var yeomanGenerator = require('yeoman-generator');
var chalk = require('chalk');
var fs = require('fs-extra');
var replace = require('replace');
var mysql = require('mysql');
var glob = require('glob');
var basename = require('basename');

var chalkError = chalk.bold.red;
var chalkNormal = chalk.yellow;
var chalkImportant = chalk.bold.white;
var chalkSuccess = chalk.bold.green;
var chalkCommand = chalk.green;

/**
 * Helper functions
 */
var variablize = function (str) {
	return str.replace(/[^a-zA-Z]/g, '_').toLowerCase();
};

// http://stackoverflow.com/questions/1026069/capitalize-the-first-letter-of-string-in-javascript
var ucfirst = function (str) {
	return str.charAt(0).toUpperCase() + str.slice(1);
};

// http://stackoverflow.com/questions/1349404/generate-a-string-of-5-random-characters-in-javascript
var randString = function (n) {
	var num = n || 5;
	var text = '';
	var possible = 'abcdefghijklmnopqrstuvwxyz';

    for (var i = 0; i < num; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}

	return text;
};

/**
 * SleekWP Generator
 */
var SleekWPGenerator = yeomanGenerator.Base.extend({
	/**
	 * Constructor
	 */
	constructor: function () {
		yeomanGenerator.Base.apply(this, arguments);

		this.dbName = 'wp_' + this.appname;
		this.localDomain = this.appname + '.dev';

		this.log(chalkImportant('Welcome! Follow these easy steps and you\'ll soon have WordPress and SleekWP installed.'));
		this.log(chalkNormal('Your domain will be http://' + this.localDomain + ', your theme name will be "' + this.appname + '"\nand I will also go ahead and create a database for WP called "' + this.dbName));
	},

	/**
	 * Get input
	 */
	prompting: function () {
		var done = this.async();

		this.prompt([
			{
				type: 'input',
				name: 'dbUser',
				message: 'Database Username:',
				default: 'root'
			},
			{
				type: 'input',
				name: 'dbPass',
				message: 'Database Password:',
				default: 'bamsepuck'
			},
			{
				type: 'input',
				name: 'dbHost',
				message: 'Database Host:',
				default: 'localhost'
			},
			{
				type: 'input',
				name: 'dbTblPrefix',
				message: 'Database Table Prefix',
				default: randString(5).toLowerCase() + '_'
			},
			{
				type: 'input',
				name: 'gitUser',
				message: 'GIT Username:',
				default: 'invisebuoy'
			},
			{
				type: 'input',
				name: 'gitTeam',
				message: 'GIT Team:',
				default: 'invise'
			},
			{
				type: 'input',
				name: 'wpUser',
				message: 'WordPress username (password will be "password"):',
				default: 'siteadmin'
			},
			{
				type: 'input',
				name: 'wpPlugins',
				message: 'Comma separated list of WordPress plugins you would like to install:',
				default: 'advanced-custom-fields, wordpress-seo, wp-smushit, duplicate-post, regenerate-thumbnails, post-type-archive-links, clean-image-filenames, simple-301-redirects'
			}
		], function (answers) {
			this.dbUser = answers.dbUser;
			this.dbPass = answers.dbPass;
			this.dbHost = answers.dbHost;
			this.gitUser = answers.gitUser;
			this.gitTeam = answers.gitTeam;
			this.gitPass = answers.gitPass;
			this.wpUser = answers.wpUser;
			this.dbTblPrefix = answers.dbTblPrefix;
			this.wpPlugins = answers.wpPlugins.split(',');

			done();
		}.bind(this));
	},

	/**
	 * Downloads WP
	 */
	__downloadWP: function () {
		this.log(chalkNormal('Downloading latest WordPress...'));

		var done = this.async();

		// Download latest WP from wordpress.org
		this.extract('https://wordpress.org/latest.zip', this.destinationRoot(), function (err) {
			if (err) {
				this.log(chalkError('ERROR: ' + err));

				return done(err);
			}

			// Copy everything from the newly unzipped wordpress/ directory to our root directory
			fs.copy(this.destinationPath('wordpress'), this.destinationRoot(), function (err) {
				if (err) {
					this.log(chalkError('ERROR: ' + err));

					return done(err);
				}

				// Remove newly unzipped wordpress-directory
				fs.remove(this.destinationPath('wordpress'));

				// Also remove the default themes
				fs.remove(this.destinationPath('wp-content/themes/twentythirteen'));
				fs.remove(this.destinationPath('wp-content/themes/twentyfourteen'));
				fs.remove(this.destinationPath('wp-content/themes/twentyfifteen'));
				fs.remove(this.destinationPath('wp-content/themes/twentysixteen'));

				// Finally create an uploads dir with 755
				fs.mkdirs(this.destinationPath('wp-content/uploads'), {mode: 0755});

				this.log(chalkSuccess('WordPress installed!'));

				done();
			}.bind(this));
		}.bind(this));
	},

	/**
	 * Installs SleekChild
	 */
	__installSleekChild: function () {
		this.log(chalkNormal('\n\nInstalling SleekChild...'));

		var done = this.async();

		this.remote('powerbuoy', 'SleekChild', 'master', function (err, remote) {
			if (err) {
				this.log(chalkError('ERROR: ' + err));

				return done(err);
			}

			// Copy SleekChild to theme directory
			fs.copy(this.cacheRoot() + '/powerbuoy/SleekChild/master/', this.destinationPath('wp-content/themes/' + this.appname + '/'), function (err) {
				if (err) {
					this.log(chalkError('ERROR: ' + err));

					return done(err);
				}

				this.log(chalkSuccess('SleekChild installed as "' + this.appname + '"!'));

				done();
			}.bind(this));
		}.bind(this), true);
	},

	/**
	 * Installs plugins
	 */
	__installWPPlugins: function () {
		this.log(chalkNormal('\n\nInstalling WordPress plug-ins...'));

		var done = this.async();
		var numPlugins = this.wpPlugins.length;
		var donePlugins = 0;

		this.wpPlugins.forEach(function (plugin) {
			plugin = plugin.trim();

			this.log(chalkNormal('Installing ' + plugin + '...'));

			this.extract('https://downloads.wordpress.org/plugin/' + plugin + '.zip', this.destinationPath('wp-content/plugins/'), function (err) {
				donePlugins++;

				if (err) {
					this.log(chalkError('ERROR: ' + err));
				}

				// TODO: Is this really the best way to do this?
				if (donePlugins == numPlugins) {
					done();

					this.log(chalkSuccess('Plug-ins successfully installed!'));
				}
			}.bind(this));
		}.bind(this));
	},

	/**
	 * Do some writing
	 */
	writing: {
		/**
		 * Rewrites SleekChild-functions
		 */
		__rewriteSleekChild: function () {
			this.log(chalkNormal('\n\nRewriting SleekChild functions to ' + this.appname + '...'));

			var functionsPath = this.destinationPath('wp-content/themes/' + this.appname + '/functions.php');
			var stylePath = this.destinationPath('wp-content/themes/' + this.appname + '/style.css');

			replace({
				regex: 'sleek_child',
				replacement: this.appname,
				paths: [functionsPath, stylePath],
				recursive: false,
				silent: true
			});

			replace({
				regex: 'SleekChild',
				replacement: ucfirst(this.appname),
				paths: [functionsPath, stylePath],
				recursive: false,
				silent: true
			});

			this.log(chalkSuccess('Function names and translation domain changed to "' + this.appname + '"!'));
		},

		/**
		 * Creates wp-config, htaccess and gitignore file
		 */
		copyTemplates: function () {
			this.log(chalkNormal('\n\nCreating wp-config.php, .htaccess and WP-Core .gitignore'));

			this.fs.copyTpl(this.templatePath('wp-config.php'), this.destinationPath('wp-config.php'), {
				dbName: this.dbName,
				dbUser: this.dbUser,
				dbPass: this.dbPass,
				dbHost: this.dbHost,
				dbTblPrefix: this.dbTblPrefix
			}, function (err, goo, bar) {
				this.log(chalkError(err));
				this.log(chalkError(goo));
				this.log(chalkError(bar));
			}.bind(this));

			this.fs.copyTpl(this.templatePath('db.sql'), this.destinationPath('db.sql'), {
				appname: this.appname,
				localDomain: this.localDomain,
				dbTblPrefix: this.dbTblPrefix,
				wpUser: this.wpUser
			}, function (err, goo, bar) {
				this.log(chalkError(err));
				this.log(chalkError(goo));
				this.log(chalkError(bar));
			}.bind(this));

			this.fs.copyTpl(this.templatePath('_htaccess'), this.destinationPath('.htaccess'));
			this.fs.copyTpl(this.templatePath('_gitignore'), this.destinationPath('.gitignore'));
		}
	},

	install: {
		/**
		 * Creates DB
		 */
		createDB: function () {
			this.log(chalkNormal('\n\nCreating database...'));

			var done = this.async();

			var connection = mysql.createConnection({
				host: this.dbHost,
				user: this.dbUser,
				password: this.dbPass,
				multipleStatements: true
			});

			connection.connect(function (err) {
				if (err) {
					this.log(chalkError(err));

					return done(err);
				}

				var db = fs.readFileSync(this.destinationPath('db.sql'), {
					encoding: 'utf8'
				});

				connection.query('CREATE DATABASE IF NOT EXISTS ' + mysql.escapeId(this.dbName), function (err, rows, fields) {
					if (err) {
						this.log(chalkError(err));

						return done(err);
					}

					/* connection.query('USE ' + mysql.escapeId(this.dbName), function (err, rows, fields) {
						if (err) {
							this.log(chalkError(err));

							return done(err);
						}

						connection.query(db, function (err, rows, fields) {
							if (err) {
								this.log(chalkError(err));

								return done(err);
							} */

							connection.end();

							done();
					//	}.bind(this));
					// }.bind(this));
				}.bind(this));
			}.bind(this));
		},

		/**
		 * Sets up VHOST
		 */
		setupVHOST: function () {
			this.log(chalkNormal('\n\nSetting up a VHOST pointing to http://' + this.localDomain + '/...'));

			this.fs.copyTpl(this.templatePath('vhost.conf'), this.destinationPath('vhost.conf'), {
				localDomain: this.localDomain,
				path: this.destinationRoot() + '/',
				appname: this.appname
			});

			// TODO: Unable to run this without SUDO
			/* this.spawnCommand('cp', ['vhost', '/etc/apache2/sites-available/' + this.appname + '.conf'], {
				cwd: this.destinationRoot()
			}).on('close', function () {
				fs.remove(this.destinationPath('vhost.conf'));

				this.spawnCommand('a2ensite', [this.appname]).on('close', function () {
					this.spawnCommand('service', ['apache2', 'reload']).on('close', function () {
						replace({
							regex: '127\.0\.0\.1',
							replacement: '127.0.0.1 ' + this.localDomain + ' ',
							paths: ['/etc/hosts'],
							recursive: false,
							silent: true
						});
					});
				});
			}.bind(this)); */
		},

		/**
		 * Initializes GIT
		 */
		initGIT: function () {
			this.log(chalkNormal('\n\nInitializing GIT with username ' + this.gitUser + '...'));

			var originURL = 'https://' + this.gitUser + '@bitbucket.org/' + this.gitTeam + '/' + this.appname + '.git';
			var productionURL = 'git@git.wpengine.com:production/' + this.appname + '.git';
			var stagingURL = 'git@git.wpengine.com:staging/' + this.appname + '.git'

			var done = this.async();

			// TODO: Is this really the best way to do this?
			this.spawnCommand('git', ['init'], {
				cwd: this.destinationRoot()
			}).on('close', function () {
				this.spawnCommand('git', ['remote', 'add', 'origin', originURL]).on('close', function () {
					this.spawnCommand('git', ['remote', 'add', 'production', productionURL]).on('close', function () {
						this.spawnCommand('git', ['remote', 'add', 'staging', stagingURL]).on('close', function () {
							this.log(chalkSuccess('GIT successfully setup! (locally)'));

							done();
						}.bind(this));
					}.bind(this));
				}.bind(this));
			}.bind(this));
		},

		/**
		 * Setup SleekWP as a GIT Submodule
		 */
		sleekGitSubmodule: function () {
			this.log(chalkNormal('\n\nSetting up SleekWP as GIT Submodule...'));

			var done = this.async();

			this.spawnCommand('git', ['submodule', 'add', 'https://github.com/powerbuoy/SleekWP', 'wp-content/themes/sleek'], {
				cwd: this.destinationRoot()
			}).on('close', function () {
				this.spawnCommand('git', ['submodule', 'update', '--init', '--recursive'], {
					cwd: this.destinationRoot()
				}).on('close', function () {
					this.log(chalkSuccess('SleekWP Installed as GIT Submodule!'));

					done();
				}.bind(this));
			}.bind(this));
		},

		/**
		 * NPM Install
		 */
		npmInstall: function () {
			this.log(chalkNormal('\n\nRunning NPM Install on SleekWP...'));

			var done = this.async();

			// Run NPM Install on SleekWP
			this.spawnCommand('npm', ['install'], {
				cwd: this.destinationPath('wp-content/themes/sleek/')
			}).on('close', function () {
				this.log(chalkSuccess('NPM Install ran successfully on SleekWP!'));
				this.log(chalkNormal('\n\nRunning NPM Install on child theme...'));

				// Run NPM Install on child theme
				this.spawnCommand('npm', ['install'], {
					cwd: this.destinationPath('wp-content/themes/' + this.appname + '/')
				}).on('close', function () {
					this.log(chalkSuccess('NPM Install ran successfully on child theme!'));

					done();
				}.bind(this));
			}.bind(this));
		},

		/**
		 * Copies all SleekCSS config and its general.scss file to project folder
		 */
		setupSleekCSS: function () {
			this.log(chalkNormal('\n\nSetting up SleekCSS config and general.scss...'));

			var done = this.async();

			// Remove SleekChild's default all.scss
			fs.remove(this.destinationPath('wp-content/themes/' + this.appname + '/src/sass/all.scss'));

			// Copy our template (based on the theme using SleekCSS)
			this.fs.copyTpl(this.templatePath('all.scss'), this.destinationPath('wp-content/themes/' + this.appname + '/src/sass/all.scss'));

			// Move SleekCSS's general.scss to our sass directory
			fs.copySync(this.destinationPath('wp-content/themes/' + this.appname + '/node_modules/sleek-css/general.scss'), this.destinationPath('wp-content/themes/' + this.appname + '/src/sass/general.scss'));

			// Create directories for components and modules
			fs.outputFileSync(this.destinationPath('wp-content/themes/' + this.appname + '/src/sass/modules/_my-module.scss'), '/**\n * Example Module\n */\n#my-module {\n\tbackground: red;\n}');
			fs.outputFileSync(this.destinationPath('wp-content/themes/' + this.appname + '/src/sass/components/_my-component.scss'), '/**\n * Example Component\n */\n.my-component {\n\tbackground: blue;\n}');

			// Generate a config.scss from all SleekCSS/config/*.scss files
			glob(this.destinationPath('wp-content/themes/' + this.appname + '/node_modules/sleek-css/config/*.scss'), {}, function (err, files) {
				var output = '';

				files.forEach(function (file) {
					output += '/**\n * ' + ucfirst(basename(file).replace('_', '')).replace('-', ' ') + '\n */\n' + fs.readFileSync(file) + '\n';
				}.bind(this));

				fs.writeFileSync(this.destinationPath('wp-content/themes/' + this.appname + '/src/sass/config.scss'), output);

				replace({
					regex: ' !default;',
					replacement: ';',
					paths: [this.destinationPath('wp-content/themes/' + this.appname + '/src/sass/config.scss')],
					recursive: false,
					silent: true
				});

				done();
			}.bind(this));
		},

		/**
		 * Run Gulp
		 */
		gulp: function () {
			this.log(chalkNormal('\n\nRunning gulp'));

			var done = this.async();

			// Run Gulp
			this.spawnCommand('gulp', [], {
				cwd: this.destinationPath('wp-content/themes/' + this.appname + '/')
			}).on('close', function () {
				this.log(chalkSuccess('Gulp ran successfully!'));

				done();
			}.bind(this));
		}
	},

	/**
	 * Done! :D
	 */
	end: function () {
		// TODO: Automatically copy vhost
		this.log(chalkError('\n\nUnable to copy Vhost, please run this command manually:'));
		this.log(chalkCommand('echo "127.0.0.1 ' + this.appname + '.dev" | sudo tee --append /etc/hosts && sudo mv vhost.conf /etc/apache2/sites-available/' + this.appname + '.conf && sudo a2ensite ' + this.appname + ' && sudo service apache2 reload'));

		// TODO: Use Bitbucket & WPEngine API's to do this automatically
		this.log(chalkNormal('\n\nGIT is set up locally with remote pointing to Bitbucket and WPEngine under your appname (' + this.appname + '). You need to create a ' + this.appname + ' repository with owner ' + this.gitTeam + ', and then push to that repo:'));
		this.log(chalkCommand('git add --all && git commit -m "Initial commit" && git push -u origin master'));
		this.log(chalkNormal('You also need to add your public key to WPEngine in order to push to staging/production:'));
		this.log(chalkCommand('git push staging master'));
		this.log(chalkCommand('git push production master'));

		// Done :D
		this.log(chalk.magenta('\n\nYou\'re all set! View your new site on http://' + this.localDomain + '\nHappy coding! :D'));
	}
});

module.exports = SleekWPGenerator;
