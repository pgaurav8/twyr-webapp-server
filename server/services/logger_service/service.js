'use strict';

/* eslint-disable security/detect-object-injection */

/**
 * Module dependencies, required for ALL Twyr' modules
 * @ignore
 */

/**
 * Module dependencies, required for this module
 * @ignore
 */
const TwyrBaseService = require('twyr-base-service').TwyrBaseService;
const TwyrSrvcError = require('twyr-service-error').TwyrServiceError;

/**
 * @class   LoggerService
 * @extends {TwyrBaseService}
 * @classdesc The Twyr Web Application Server Logger Service.
 *
 * @description
 * Allows the rest of the Twyr Modules to log stuff.
 *
 */
class LoggerService extends TwyrBaseService {
	// #region Constructor
	constructor(parent, loader) {
		super(parent, loader);
	}
	// #endregion

	// #region startup/teardown code
	/**
	 * @async
	 * @function
	 * @override
	 * @instance
	 * @memberof LoggerService
	 * @name     _setup
	 *
	 * @returns  {null} Nothing.
	 *
	 * @summary  Sets up the logger - based on Winston.
	 */
	async _setup() {
		try {
			await super._setup();

			const path = require('path');
			const winston = require('winston');

			const rootPath = path.dirname(path.dirname(require.main.filename));
			const transports = [];

			const maskSensitiveData = winston.format((info) => {
				if(!info) return info;
				if(!Object.keys(info).length) return info;

				Object.keys(info).forEach((key) => {
					if(!info[key]) {
						delete info[key];
						return;
					}

					const dangerousKeys = Object.keys(info[key]).filter((infoKeyKey) => {
						return (infoKeyKey.toLowerCase().indexOf('password') >= 0) || (infoKeyKey.toLowerCase().indexOf('image') >= 0) || (infoKeyKey.toLowerCase().indexOf('random') >= 0) || (infoKeyKey === '_');
					});

					dangerousKeys.forEach((dangerousKey) => {
						delete info[key][dangerousKey];
					});

					if(!Object.keys(info[key]).length)
						delete info[key];
				});

				if(!Object.keys(info).length)
					return {};

				return info;
			});

			for(const transportIdx in this.$config.transports) {
				if(!Object.prototype.hasOwnProperty.call(this.$config.transports, transportIdx) && !{}.hasOwnProperty.call(this.$config.transports, transportIdx))
					continue;

				const thisTransport = JSON.parse(JSON.stringify(this.$config.transports[transportIdx]));
				if(thisTransport.filename) {
					const baseName = path.basename(thisTransport.filename, path.extname(thisTransport.filename));
					const dirName = path.isAbsolute(thisTransport.filename) ? path.dirname(thisTransport.filename) : path.join(rootPath, path.dirname(thisTransport.filename));

					thisTransport.filename = path.resolve(path.join(dirName, `${baseName}-${this.$parent.$uuid}${path.extname(thisTransport.filename)}`));
				}

				const transportName = thisTransport.name || 'Console';
				delete thisTransport.name;

				const transportFormats = [];
				transportFormats.push(winston.format.timestamp());
				transportFormats.push(winston.format.metadata({
					'fillExcept': ['level', 'message', 'timestamp', 'responseTime']
				}));
				transportFormats.push(maskSensitiveData());

				if(typeof thisTransport.format === 'string') { // eslint-disable-line curly
					transportFormats.push(winston.format[thisTransport.format]());
				}

				if(Array.isArray(thisTransport.format)) { // eslint-disable-line curly
					thisTransport.format.forEach((transportFormat) => {
						if(typeof transportFormat === 'string') {
							transportFormats.push(winston.format[transportFormat]());
							return;
						}

						if(transportFormat.name === 'printf') { // eslint-disable-line curly
							transportFormat.options = new Function('info', 'opts', transportFormat.options); // eslint-disable-line no-new-func
							transportFormats.push(winston.format[transportFormat.name](transportFormat.options));
							return;
						}

						if(transportFormat.name === 'custom') {
							transportFormat.function = new Function('info', 'opts', transportFormat.function); // eslint-disable-line no-new-func

							const thisFormat = winston.format(transportFormat.function);
							transportFormats.push(thisFormat(transportFormat.options));
							return;
						}

						const thisFormat = winston.format[transportFormat.name](transportFormat.options);
						transportFormats.push(thisFormat);
					});
				}

				thisTransport.format = winston.format.combine.apply(winston, transportFormats);
				transports.push(new winston.transports[transportName](thisTransport));
			}

			this.$winston = winston.createLogger({
				'level': this.$config.logger.level,
				'transports': transports,
				'exitOnError': this.$config.logger.exitOnError
			});

			// Add trace === silly
			this.$winston.trace = this.$winston.silly;

			// Console log any errors emitted by Winston itself
			this.$winston.on('error', (err) => {
				console.error(`Winston Logger Error:\n${err.stack}`);
			});

			// The first log of this logger instance...
			if(twyrEnv === 'development' || twyrEnv === 'test') this.$winston.debug('Ticking away the packets that make up a dull day...');
			return null;
		}
		catch(err) {
			throw new TwyrSrvcError(`${this.name}::_setup error`, err);
		}
	}

	/**
	 * @async
	 * @function
	 * @override
	 * @instance
	 * @memberof LoggerService
	 * @name     _teardown
	 *
	 * @returns  {undefined} Nothing.
	 *
	 * @summary  Deletes the logger instance.
	 */
	async _teardown() {
		try {
			// The last log of this logger instance...
			if(twyrEnv === 'development' || twyrEnv === 'test') this.$winston.debug('Goodbye, wi-fi, goodbye...');

			this.$winston.clear();
			delete this.$winston;

			await super._teardown();
			return null;
		}
		catch(err) {
			throw new TwyrSrvcError(`${this.name}::_teardown error`, err);
		}
	}
	// #endregion

	// #region Properties
	/**
	 * @override
	 */
	get Interface() {
		return this.$winston;
	}

	/**
	 * @override
	 */
	get dependencies() {
		return ['ConfigurationService'].concat(super.dependencies);
	}

	/**
	 * @override
	 */
	get basePath() {
		return __dirname;
	}
	// #endregion
}

exports.service = LoggerService;
