/*
 * Copied unchanged from the owner's "Atlas Research Planner" plugin 1.7.1 (src/app/engine.js in the
 * public source map of assets/dist/planner.js; licence GPL-2.0-or-later). The plugin's own header
 * below says engine.js is an exact mirror of the PHP classes behind the live POST /calculate, so
 * running it on the server gives the same results (proved by src/lib/planner/calculate.test.ts).
 * Do not edit: copy a newer version over it instead.
 */
/* eslint-disable */
/**
 * Calculation engine of the Atlas Research Planner (instant previews in the browser).
 *
 * Exact mirror of includes/Domain/{LineInput,Capacity,Calculator,LineResult,InventoryTimeline,
 * PriceEstimate}.php. tests/fixtures/calculation-vectors.json is run by both the PHP and the JS test
 * suites and proves both produce identical results. The server `/calculate` response is always
 * authoritative; this module only renders previews while the user types.
 *
 * All quantity and money math uses BigInt (never binary floats). Dates use pure integer civil-date
 * arithmetic (no Date objects, no time zones, no DST). ES module, no dependencies.
 *
 * Public API:
 *   validateLine( raw, limits )                    → { ok, line, errors }
 *   calculateLine( line, capacities, packCount, unitPrice, priceDecimals, bundleCoveredUnits )
 *                                                  → result (same keys as LineResult::to_array())
 *   buildTimeline( line, result, planStart )        → timeline (same keys as InventoryTimeline::build())
 *   parseCapacity( { dimension?, amount, unit, basis } ) → Capacity (mirror of Capacity::from_array())
 *   MAX_TOTAL_SCALED, CODES, DEFAULT_LIMITS, date and price helpers, and everything from units.js.
 *
 * Capacities are passed in their array form `{dimension, amount: 'decimal string', unit, basis}`
 * (exactly what Capacity::to_array() and the catalogue API return); calculateLine() parses them with
 * parseCapacity(), as the PHP Calculator does with Capacity::from_array().
 *
 * Known, documented difference: after JSON.parse JavaScript cannot distinguish 2.0 from 2 (or 1e3
 * from 1000), so integer fields given as integral floats are accepted here but rejected by the
 * server with `integer_required`.
 *
 * @module engine
 */

import {
	MAX_TOTAL_SCALED,
	SCALE,
	MAX_VALUE,
	ValidationError,
	CalculationError,
	validationEntry,
	notice,
	normalizeUnit,
	dimensionOf,
	factor,
	isDimension,
	isIntegerUnit,
	decimalError,
	parseDecimal,
	parseAmount,
	canonicalAmount,
	formatScaled,
	fromScaled,
	CLIENT_BUNDLE,
	ceilDiv,
	mulChecked,
	addChecked,
	subChecked,
	mulDivFloor,
	permilleToPercent,
	pow10,
	intFromDigits,
} from './units.js';

export * from './units.js';

/**
 * Stable codes (ARCHITECTURE §1.3) emitted or used by the domain layer. Listed explicitly (not
 * derived from the English catalogues, which the browser bundle omits — see CLIENT_BUNDLE).
 */
export const CODES = Object.freeze( {
	validation: Object.freeze( [
		'unknown_field',
		'required',
		'invalid_type',
		'invalid_number',
		'too_many_decimals',
		'not_positive',
		'too_large',
		'integer_required',
		'invalid_unit',
		'invalid_mode',
		'invalid_period_unit',
		'out_of_range',
		'invalid_date',
		'invalid_id',
		'too_long',
		'too_many_lines',
	] ),
	calculation: Object.freeze( [ 'unit_incompatible', 'no_capacity', 'quantity_too_large', 'invalid_pack_count', 'mode_not_allowed' ] ),
	warnings: Object.freeze( [
		'price_unavailable',
		'override_shortfall',
		'bundle_coverage_applied',
		'timeline_aggregated',
		'no_start_date',
		'containers_capped',
		'out_of_stock',
		'on_backorder',
		'price_hidden',
	] ),
	assumptions: Object.freeze( [
		'usable_equals_labelled',
		'usable_amount_verified',
		'event_count_explicit',
		'whole_units_rounded_up',
		'pack_boundary',
		'calendar_months',
		'end_date_exclusive',
		'estimate_excludes_tax_shipping_discounts',
	] ),
} );

/** Allowed line keys in canonical order. */
export const FIELDS = Object.freeze( [
	'id',
	'product_id',
	'variation_id',
	'variation_attributes',
	'mode',
	'amount',
	'unit',
	'events_per_period',
	'period_unit',
	'periods',
	'start_date',
	'override_quantity',
	'manual_quantity',
	'label',
] );

/** Calculation modes. */
export const MODES = Object.freeze( [ 'schedule', 'direct', 'manual' ] );

/** Period units. */
export const PERIOD_UNITS = Object.freeze( [ 'day', 'week', 'month' ] );

/** Default (and maximum) limits; overrides can only tighten them. */
export const DEFAULT_LIMITS = Object.freeze( {
	max_events_per_period: 1000,
	max_periods_day: 3660,
	max_periods_week: 520,
	max_periods_month: 120,
	max_event_count: 1000000,
	max_quantity: 9999,
} );

/** Largest product / variation ID (2^53 − 1). */
export const MAX_ID = 9007199254740991;

/** Largest count emitted in a result (2^53 − 1). */
export const MAX_COUNT = 9007199254740991n;

/** Pack count bounds. */
export const MIN_PACK_COUNT = 1;
export const MAX_PACK_COUNT = 1000;

/** Text limits. */
export const MAX_LABEL_LENGTH = 80;
export const MAX_ATTRIBUTES = 20;
export const MAX_ATTRIBUTE_VALUE_LENGTH = 200;

/** Price limits. */
export const PRICE_MAX_DECIMALS = 8;
export const PRICE_MAX_LENGTH = 40;

/** Date window for inputs. */
export const MIN_DATE = '2000-01-01';
export const MAX_DATE = '2100-12-31';

/** Timeline limits. */
export const MAX_POINTS = 366;
export const MAX_CONTAINERS = 500;
export const MAX_DATED_PERIOD_INDEX = 10000000;
export const MAX_YEAR = 9999;

/** Summary of every review event (exact wording required). */
export const REVIEW_SUMMARY = 'Research inventory review';

/** Capacity bases and preference. */
export const BASES = Object.freeze( [ 'labelled', 'usable', 'fill_volume' ] );
export const BASIS_PRIORITY = Object.freeze( { usable: 3, fill_volume: 2, labelled: 1 } );
const CAPACITY_KEYS = Object.freeze( [ 'dimension', 'amount', 'unit', 'basis' ] );

const ID_PATTERN = /^[a-z0-9_-]{1,40}$/;
const SAFE_FIELD_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const ATTRIBUTE_KEY_PATTERN = /^attribute_[a-z0-9_%-]{1,190}$/;
const DATE_PATTERN = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;
const PRICE_PATTERN = /^([0-9]+)(?:\.([0-9]+))?$/;
const CONTROL_PATTERN = /[\u0000-\u001F\u007F-\u009F]/;
const TYPE_ORDER = Object.freeze( { start: 0, container_depleted: 1, run_out: 2, end: 3 } );
const TWO_POW_63 = 2 ** 63;

const hasOwn = ( object, key ) => Object.prototype.hasOwnProperty.call( object, key );
const own = ( object, key ) => ( hasOwn( object, key ) ? object[ key ] : undefined );

/* ------------------------------------------------------------------------------------------------
 * Text helpers (mirror of LineInput statics).
 * --------------------------------------------------------------------------------------------- */

/**
 * Field name safe to echo in an error (`^[A-Za-z0-9_-]{1,64}$`, else `_invalid_key`).
 *
 * @param {string} key Key.
 * @return {string} Safe field name.
 */
export function safeFieldName( key ) {
	const k = String( key );
	return SAFE_FIELD_PATTERN.test( k ) ? k : '_invalid_key';
}

/**
 * Whether a string is well-formed Unicode without control characters (C0, DEL, C1).
 *
 * @param {string} s Text.
 * @return {boolean} Plain text.
 */
export function isPlainText( s ) {
	return typeof s === 'string' && ! hasLoneSurrogate( s ) && ! CONTROL_PATTERN.test( s );
}

/**
 * Whether a string contains an unpaired UTF-16 surrogate (not valid Unicode text; PHP's
 * json_decode() rejects such input). A plain scan, because regex lookbehind is a syntax error in
 * Safari before 16.4 and would break the whole bundle.
 *
 * @param {string} s Text.
 * @return {boolean} Has a lone surrogate.
 */
function hasLoneSurrogate( s ) {
	for ( let i = 0; i < s.length; i++ ) {
		const c = s.charCodeAt( i );
		if ( c >= 0xd800 && c <= 0xdbff ) {
			const next = s.charCodeAt( i + 1 );
			if ( next >= 0xdc00 && next <= 0xdfff ) {
				i++;
				continue;
			}
			return true;
		}
		if ( c >= 0xdc00 && c <= 0xdfff ) {
			return true;
		}
	}
	return false;
}

/**
 * Length in Unicode code points.
 *
 * @param {string} s Text.
 * @return {number} Length.
 */
export function textLength( s ) {
	return Array.from( s ).length;
}

/**
 * Validates a JSON integer field (mirror of LineInput::int_field()).
 *
 * @param {*}      value     Raw value (not null).
 * @param {number} min       Minimum.
 * @param {number} max       Maximum.
 * @param {string} rangeCode Code when out of range.
 * @return {Array} [value|null, code|null].
 */
function intField( value, min, max, rangeCode ) {
	if ( typeof value === 'number' ) {
		if ( ! Number.isFinite( value ) || ! Number.isInteger( value ) || Math.abs( value ) >= TWO_POW_63 ) {
			return [ null, 'integer_required' ];
		}
		if ( value < min || value > max ) {
			return [ null, rangeCode ];
		}
		return [ value === 0 ? 0 : value, null ];
	}
	return [ null, 'invalid_type' ];
}

/**
 * Effective limits: defaults, optionally tightened by positive integer overrides.
 *
 * @param {Object} overrides Overrides keyed like DEFAULT_LIMITS.
 * @return {Object} Limits.
 */
export function effectiveLimits( overrides = {} ) {
	const limits = { ...DEFAULT_LIMITS };
	const source = overrides && typeof overrides === 'object' ? overrides : {};
	for ( const [ key, defaultValue ] of Object.entries( DEFAULT_LIMITS ) ) {
		const value = own( source, key );
		if ( typeof value === 'number' && Number.isInteger( value ) && value >= 1 ) {
			limits[ key ] = Math.min( defaultValue, value );
		}
	}
	return limits;
}

/* ------------------------------------------------------------------------------------------------
 * Line validation (mirror of LineInput::from_array()).
 * --------------------------------------------------------------------------------------------- */

/**
 * Validates a raw line and returns errors plus internal values (including amountScaled).
 *
 * @param {*}      raw    Raw line.
 * @param {Object} limits Limit overrides.
 * @return {{errors: Array, values: Object|null}} Parse result.
 */
function parseLine( raw, limits ) {
	const lim = effectiveLimits( limits );
	if ( raw === null || typeof raw !== 'object' ) {
		return { errors: [ validationEntry( 'line', 'invalid_type' ) ], values: null };
	}
	const errors = [];
	const err = ( field, code ) => errors.push( validationEntry( field, code ) );

	const unknown = Object.keys( raw )
		.filter( ( key ) => ! FIELDS.includes( key ) )
		.map( safeFieldName )
		.sort();
	for ( const field of unknown ) {
		err( field, 'unknown_field' );
	}

	const v = {
		id: '',
		product_id: 0,
		variation_id: 0,
		variation_attributes: {},
		mode: '',
		amount: null,
		unit: null,
		amountScaled: null,
		events_per_period: null,
		period_unit: null,
		periods: null,
		start_date: null,
		override_quantity: null,
		manual_quantity: null,
		label: '',
	};

	// id.
	const id = own( raw, 'id' );
	if ( id === undefined || id === null || id === '' ) {
		err( 'id', 'required' );
	} else if ( typeof id !== 'string' ) {
		err( 'id', 'invalid_type' );
	} else if ( ! ID_PATTERN.test( id ) ) {
		err( 'id', 'invalid_id' );
	} else {
		v.id = id;
	}

	// product_id.
	const productId = own( raw, 'product_id' );
	if ( productId === undefined || productId === null ) {
		err( 'product_id', 'required' );
	} else {
		const [ value, code ] = intField( productId, 1, MAX_ID, 'invalid_id' );
		if ( code !== null ) {
			err( 'product_id', code );
		} else {
			v.product_id = value;
		}
	}

	// variation_id.
	const variationId = own( raw, 'variation_id' );
	if ( variationId !== undefined && variationId !== null ) {
		const [ value, code ] = intField( variationId, 0, MAX_ID, 'invalid_id' );
		if ( code !== null ) {
			err( 'variation_id', code );
		} else {
			v.variation_id = value;
		}
	}

	// variation_attributes.
	const attributes = own( raw, 'variation_attributes' );
	if ( attributes !== undefined && attributes !== null ) {
		if ( typeof attributes !== 'object' ) {
			err( 'variation_attributes', 'invalid_type' );
		} else {
			const keys = Object.keys( attributes );
			let badType = false;
			let tooLong = keys.length > MAX_ATTRIBUTES;
			const clean = [];
			for ( const key of keys ) {
				const value = attributes[ key ];
				if ( ! ATTRIBUTE_KEY_PATTERN.test( key ) || typeof value !== 'string' || ! isPlainText( value ) ) {
					badType = true;
					continue;
				}
				if ( textLength( value ) > MAX_ATTRIBUTE_VALUE_LENGTH ) {
					tooLong = true;
					continue;
				}
				clean.push( [ key, value ] );
			}
			if ( badType ) {
				err( 'variation_attributes', 'invalid_type' );
			}
			if ( tooLong ) {
				err( 'variation_attributes', 'too_long' );
			}
			clean.sort( ( a, b ) => {
				if ( a[ 0 ] < b[ 0 ] ) {
					return -1;
				}
				return a[ 0 ] > b[ 0 ] ? 1 : 0;
			} );
			v.variation_attributes = Object.fromEntries( clean );
		}
	}

	// mode.
	let mode = own( raw, 'mode' );
	if ( mode === undefined || mode === null || mode === '' ) {
		err( 'mode', 'required' );
		mode = null;
	} else if ( typeof mode !== 'string' ) {
		err( 'mode', 'invalid_type' );
		mode = null;
	} else if ( ! MODES.includes( mode ) ) {
		err( 'mode', 'invalid_mode' );
		mode = null;
	} else {
		v.mode = mode;
	}

	// amount + unit (schedule, direct).
	if ( mode === 'schedule' || mode === 'direct' ) {
		const unitRaw = own( raw, 'unit' );
		let unit = null;
		let unitError = null;
		if ( unitRaw === undefined || unitRaw === null || unitRaw === '' ) {
			unitError = 'required';
		} else if ( typeof unitRaw !== 'string' ) {
			unitError = 'invalid_type';
		} else {
			unit = normalizeUnit( unitRaw );
			if ( unit === null ) {
				unitError = 'invalid_unit';
			}
		}

		const amountRaw = own( raw, 'amount' );
		if ( amountRaw === undefined || amountRaw === null || amountRaw === '' ) {
			err( 'amount', 'required' );
		} else if ( typeof amountRaw !== 'string' ) {
			err( 'amount', 'invalid_type' );
		} else {
			const code = decimalError( amountRaw );
			if ( code !== null ) {
				err( 'amount', code );
			} else if ( unit !== null && isIntegerUnit( unit ) && parseDecimal( amountRaw ) % SCALE !== 0n ) {
				err( 'amount', 'integer_required' );
			} else {
				v.amount = canonicalAmount( amountRaw );
				if ( unit !== null ) {
					v.amountScaled = parseAmount( amountRaw, unit );
				}
			}
		}
		if ( unitError !== null ) {
			err( 'unit', unitError );
		} else {
			v.unit = unit;
		}
	}

	// Schedule fields.
	if ( mode === 'schedule' ) {
		const eppRaw = own( raw, 'events_per_period' );
		if ( eppRaw === undefined || eppRaw === null ) {
			err( 'events_per_period', 'required' );
		} else {
			const [ value, code ] = intField( eppRaw, 1, lim.max_events_per_period, 'out_of_range' );
			if ( code !== null ) {
				err( 'events_per_period', code );
			} else {
				v.events_per_period = value;
			}
		}

		let periodUnit = own( raw, 'period_unit' );
		if ( periodUnit === undefined || periodUnit === null || periodUnit === '' ) {
			err( 'period_unit', 'required' );
			periodUnit = null;
		} else if ( typeof periodUnit !== 'string' ) {
			err( 'period_unit', 'invalid_type' );
			periodUnit = null;
		} else if ( ! PERIOD_UNITS.includes( periodUnit ) ) {
			err( 'period_unit', 'invalid_period_unit' );
			periodUnit = null;
		} else {
			v.period_unit = periodUnit;
		}

		const periodsRaw = own( raw, 'periods' );
		if ( periodsRaw === undefined || periodsRaw === null ) {
			err( 'periods', 'required' );
		} else {
			const maxPeriods = periodUnit !== null
				? lim[ 'max_periods_' + periodUnit ]
				: Math.max( lim.max_periods_day, lim.max_periods_week, lim.max_periods_month );
			const [ value, code ] = intField( periodsRaw, 1, maxPeriods, 'out_of_range' );
			if ( code !== null ) {
				err( 'periods', code );
			} else if ( v.events_per_period !== null && BigInt( v.events_per_period ) * BigInt( value ) > BigInt( lim.max_event_count ) ) {
				err( 'periods', 'too_large' );
			} else {
				v.periods = value;
			}
		}
	}

	// start_date (all modes).
	const startDate = own( raw, 'start_date' );
	if ( startDate !== undefined && startDate !== null && startDate !== '' ) {
		if ( typeof startDate !== 'string' ) {
			err( 'start_date', 'invalid_type' );
		} else {
			const code = dateError( startDate );
			if ( code !== null ) {
				err( 'start_date', code );
			} else {
				v.start_date = startDate;
			}
		}
	}

	// override_quantity (schedule, direct).
	if ( mode === 'schedule' || mode === 'direct' ) {
		const override = own( raw, 'override_quantity' );
		if ( override !== undefined && override !== null ) {
			const [ value, code ] = intField( override, 0, lim.max_quantity, 'out_of_range' );
			if ( code !== null ) {
				err( 'override_quantity', code );
			} else {
				v.override_quantity = value;
			}
		}
	}

	// manual_quantity (manual).
	if ( mode === 'manual' ) {
		const manual = own( raw, 'manual_quantity' );
		if ( manual === undefined || manual === null ) {
			err( 'manual_quantity', 'required' );
		} else {
			const [ value, code ] = intField( manual, 1, lim.max_quantity, 'out_of_range' );
			if ( code !== null ) {
				err( 'manual_quantity', code );
			} else {
				v.manual_quantity = value;
			}
		}
	}

	// label.
	const label = own( raw, 'label' );
	if ( label !== undefined && label !== null ) {
		if ( typeof label !== 'string' || ! isPlainText( label ) ) {
			err( 'label', 'invalid_type' );
		} else if ( textLength( label ) > MAX_LABEL_LENGTH ) {
			err( 'label', 'too_long' );
		} else {
			v.label = label;
		}
	}

	return { errors, values: errors.length > 0 ? null : v };
}

/**
 * Canonical line object (same keys and values as LineInput::to_array()).
 *
 * @param {Object} v Internal values.
 * @return {Object} Canonical line.
 */
function lineToArray( v ) {
	return {
		id: v.id,
		product_id: v.product_id,
		variation_id: v.variation_id,
		variation_attributes: { ...v.variation_attributes },
		mode: v.mode,
		amount: v.amount,
		unit: v.unit,
		events_per_period: v.events_per_period,
		period_unit: v.period_unit,
		periods: v.periods,
		start_date: v.start_date,
		override_quantity: v.override_quantity,
		manual_quantity: v.manual_quantity,
		label: v.label,
	};
}

/**
 * Validates a raw line (never throws).
 *
 * @param {*}      raw    Raw line (JSON-decoded object).
 * @param {Object} limits Optional limit overrides.
 * @return {{ok: boolean, line: Object|null, errors: Array<{field: string, code: string, message: string}>}} Result.
 */
export function validateLine( raw, limits = {} ) {
	const { errors, values } = parseLine( raw, limits );
	return { ok: errors.length === 0, line: values === null ? null : lineToArray( values ), errors };
}

/**
 * Validates a line or throws ValidationError; returns internal values.
 *
 * @param {Object} line Line.
 * @return {Object} Internal values.
 */
function requireLine( line ) {
	const { errors, values } = parseLine( line, {} );
	if ( errors.length > 0 ) {
		throw new ValidationError( errors );
	}
	return values;
}

/**
 * Event count of internal line values (0 for non-schedule lines).
 *
 * @param {Object} v Values.
 * @return {bigint} Event count.
 */
function eventCountOf( v ) {
	if ( v.mode !== 'schedule' || v.events_per_period === null || v.periods === null ) {
		return 0n;
	}
	return BigInt( v.events_per_period ) * BigInt( v.periods );
}

/* ------------------------------------------------------------------------------------------------
 * Capacity (mirror of Domain\Capacity).
 * --------------------------------------------------------------------------------------------- */

/**
 * Capacity of one container.
 */
export class Capacity {
	/**
	 * @param {string} dimension    Dimension.
	 * @param {bigint} amountScaled Amount in scaled base units.
	 * @param {string} unit         Unit or alias.
	 * @param {string} basis        labelled | usable | fill_volume.
	 */
	constructor( dimension, amountScaled, unit, basis ) {
		const errors = [];
		const canonical = normalizeUnit( unit );
		const amount = typeof amountScaled === 'bigint' ? amountScaled : BigInt( amountScaled );
		if ( ! isDimension( dimension ) ) {
			errors.push( validationEntry( 'dimension', 'invalid_unit' ) );
		}
		if ( canonical === null || ( isDimension( dimension ) && dimensionOf( canonical ) !== dimension ) ) {
			errors.push( validationEntry( 'unit', 'invalid_unit' ) );
		}
		if ( ! BASES.includes( basis ) ) {
			errors.push( validationEntry( 'basis', 'out_of_range' ) );
		}
		if ( amount <= 0n ) {
			errors.push( validationEntry( 'amount', 'not_positive' ) );
		} else if ( canonical !== null ) {
			const unitFactor = factor( canonical );
			if ( amount % unitFactor !== 0n ) {
				errors.push( validationEntry( 'amount', 'too_many_decimals' ) );
			} else if ( amount / unitFactor > MAX_VALUE * SCALE ) {
				errors.push( validationEntry( 'amount', 'too_large' ) );
			} else if ( isIntegerUnit( canonical ) && ( amount / unitFactor ) % SCALE !== 0n ) {
				errors.push( validationEntry( 'amount', 'integer_required' ) );
			}
		}
		if ( errors.length > 0 ) {
			throw new ValidationError( errors );
		}
		this.dimension = dimension;
		this.amountScaled = amount;
		this.unit = canonical;
		this.basis = basis;
		Object.freeze( this );
	}

	/** @return {string} Amount in its own unit. */
	amount() {
		return formatScaled( this.amountScaled, this.unit ).value;
	}

	/** @return {{dimension: string, amount: string, unit: string, basis: string}} Array form. */
	toArray() {
		return { dimension: this.dimension, amount: this.amount(), unit: this.unit, basis: this.basis };
	}
}

/**
 * Builds a Capacity from its array form (mirror of Capacity::from_array()).
 *
 * @param {Object} a `{dimension?, amount: string, unit, basis}`.
 * @return {Capacity} Capacity.
 */
export function parseCapacity( a ) {
	if ( a === null || typeof a !== 'object' ) {
		throw ValidationError.single( 'capacity', 'invalid_type' );
	}
	const errors = [];
	const unknown = Object.keys( a )
		.filter( ( key ) => ! CAPACITY_KEYS.includes( key ) )
		.map( safeFieldName )
		.sort();
	for ( const field of unknown ) {
		errors.push( validationEntry( field, 'unknown_field' ) );
	}

	let dimension = own( a, 'dimension' );
	const amount = own( a, 'amount' );
	const unit = own( a, 'unit' );
	const basis = own( a, 'basis' );

	if ( dimension !== undefined && dimension !== null && typeof dimension !== 'string' ) {
		errors.push( validationEntry( 'dimension', 'invalid_type' ) );
		dimension = null;
	} else if ( typeof dimension === 'string' && ! isDimension( dimension ) ) {
		errors.push( validationEntry( 'dimension', 'invalid_unit' ) );
		dimension = null;
	}

	let canonical = null;
	if ( unit === undefined || unit === null || unit === '' ) {
		errors.push( validationEntry( 'unit', 'required' ) );
	} else if ( typeof unit !== 'string' ) {
		errors.push( validationEntry( 'unit', 'invalid_type' ) );
	} else {
		canonical = normalizeUnit( unit );
		if ( canonical === null || ( typeof dimension === 'string' && dimensionOf( canonical ) !== dimension ) ) {
			errors.push( validationEntry( 'unit', 'invalid_unit' ) );
			canonical = null;
		}
	}

	let amountScaled = null;
	if ( amount === undefined || amount === null || amount === '' ) {
		errors.push( validationEntry( 'amount', 'required' ) );
	} else if ( typeof amount !== 'string' ) {
		errors.push( validationEntry( 'amount', 'invalid_type' ) );
	} else {
		const code = decimalError( amount );
		if ( code !== null ) {
			errors.push( validationEntry( 'amount', code ) );
		} else if ( canonical !== null ) {
			try {
				amountScaled = parseAmount( amount, canonical );
			} catch ( e ) {
				if ( ! ( e instanceof ValidationError ) ) {
					throw e;
				}
				errors.push( ...e.errors );
			}
		}
	}

	if ( basis === undefined || basis === null || basis === '' ) {
		errors.push( validationEntry( 'basis', 'required' ) );
	} else if ( typeof basis !== 'string' ) {
		errors.push( validationEntry( 'basis', 'invalid_type' ) );
	} else if ( ! BASES.includes( basis ) ) {
		errors.push( validationEntry( 'basis', 'out_of_range' ) );
	}

	if ( errors.length > 0 ) {
		throw new ValidationError( errors );
	}
	return new Capacity( dimensionOf( canonical ), amountScaled, canonical, basis );
}

/**
 * Picks the capacity for a dimension: usable > fill_volume > labelled; ties keep array order.
 *
 * @param {Capacity[]} capacities Capacities.
 * @param {string}     dimension  Dimension.
 * @return {Capacity|null} Capacity.
 */
export function pickCapacity( capacities, dimension ) {
	let best = null;
	for ( const capacity of capacities ) {
		if ( ! ( capacity instanceof Capacity ) || capacity.dimension !== dimension ) {
			continue;
		}
		if ( best === null || BASIS_PRIORITY[ capacity.basis ] > BASIS_PRIORITY[ best.basis ] ) {
			best = capacity;
		}
	}
	return best;
}

/**
 * Converts the capacities argument (Capacity instances or array forms) to Capacity instances.
 *
 * @param {Array} capacities Capacities.
 * @return {Capacity[]} Capacities.
 */
export function normalizeCapacities( capacities ) {
	if ( ! Array.isArray( capacities ) ) {
		throw ValidationError.single( 'capacities', 'invalid_type' );
	}
	const result = [];
	const errors = [];
	capacities.forEach( ( capacity, index ) => {
		if ( capacity instanceof Capacity ) {
			result.push( capacity );
		} else if ( capacity !== null && typeof capacity === 'object' ) {
			try {
				result.push( parseCapacity( capacity ) );
			} catch ( e ) {
				if ( ! ( e instanceof ValidationError ) ) {
					throw e;
				}
				for ( const error of e.errors ) {
					errors.push( validationEntry( 'capacities.' + index + '.' + error.field, error.code ) );
				}
			}
		} else {
			errors.push( validationEntry( 'capacities.' + index, 'invalid_type' ) );
		}
	} );
	if ( errors.length > 0 ) {
		throw new ValidationError( errors );
	}
	return result;
}

/* ------------------------------------------------------------------------------------------------
 * Prices (mirror of Domain\PriceEstimate).
 * --------------------------------------------------------------------------------------------- */

/**
 * Guards price decimals (0–8).
 *
 * @param {number} decimals Decimals.
 */
export function priceAssertDecimals( decimals ) {
	if ( typeof decimals !== 'number' || ! Number.isInteger( decimals ) || decimals < 0 || decimals > PRICE_MAX_DECIMALS ) {
		throw ValidationError.single( 'price_decimals', 'out_of_range' );
	}
}

/**
 * Price string to minor units, rounded half-up.
 *
 * @param {string} price    Canonical decimal price.
 * @param {number} decimals Decimals (0–8).
 * @return {bigint} Minor units.
 */
export function priceToMinor( price, decimals ) {
	priceAssertDecimals( decimals );
	const m = typeof price === 'string' && price.length <= PRICE_MAX_LENGTH ? PRICE_PATTERN.exec( price ) : null;
	if ( ! m ) {
		throw ValidationError.single( 'unit_price', 'invalid_number' );
	}
	const frac = m[ 2 ] ?? '';
	const kept = frac.padEnd( decimals, '0' ).slice( 0, decimals );
	const next = frac.length > decimals ? Number( frac[ decimals ] ) : 0;
	let minor = addChecked( mulChecked( intFromDigits( m[ 1 ] ), pow10( decimals ) ), kept === '' ? 0n : BigInt( kept ) );
	if ( next >= 5 ) {
		minor = addChecked( minor, 1n );
	}
	return minor;
}

/**
 * Minor units to a decimal string with exactly `decimals` places.
 *
 * @param {bigint} minor    Minor units.
 * @param {number} decimals Decimals.
 * @return {string} Amount.
 */
export function priceFromMinor( minor, decimals ) {
	priceAssertDecimals( decimals );
	return fromScaled( minor, decimals );
}

/**
 * Normalizes a price to exactly `decimals` places.
 *
 * @param {string} price    Price.
 * @param {number} decimals Decimals.
 * @return {string} Price.
 */
export function priceNormalize( price, decimals ) {
	return priceFromMinor( priceToMinor( price, decimals ), decimals );
}

/**
 * Line estimate: round_half_up(price) × quantity.
 *
 * @param {string}        price    Unit price.
 * @param {number|bigint} qty      Quantity (≥ 0).
 * @param {number}        decimals Decimals.
 * @return {string} Estimate.
 */
export function priceLine( price, qty, decimals ) {
	const q = typeof qty === 'bigint' ? qty : BigInt( qty );
	if ( q < 0n ) {
		throw ValidationError.single( 'quantity', 'out_of_range' );
	}
	return priceFromMinor( mulChecked( priceToMinor( price, decimals ), q ), decimals );
}

/**
 * Sum of decimal amounts (null and '' skipped).
 *
 * @param {Array<string|null>} amounts  Amounts.
 * @param {number}             decimals Decimals.
 * @return {string} Sum.
 */
export function priceSum( amounts, decimals ) {
	let total = 0n;
	for ( const amount of amounts ) {
		if ( amount === null || amount === undefined || amount === '' ) {
			continue;
		}
		if ( typeof amount !== 'string' ) {
			throw ValidationError.single( 'amounts', 'invalid_type' );
		}
		total = addChecked( total, priceToMinor( amount, decimals ) );
	}
	return priceFromMinor( total, decimals );
}

/* ------------------------------------------------------------------------------------------------
 * Calculator (mirror of Domain\Calculator + LineResult::to_array()).
 * --------------------------------------------------------------------------------------------- */

const plural = ( n, singular, pluralNoun ) => `${ n } ${ BigInt( n ) === 1n ? singular : pluralNoun }`;
const unitsText = ( n ) => plural( n, 'unit', 'units' );
const amountText = ( scaled, unit ) => {
	const f = formatScaled( scaled, unit );
	return ( f.exact ? '' : '≈' ) + f.value + ' ' + unit;
};
const amountObject = ( scaled, unit ) => ( { value: formatScaled( scaled, unit ).value, unit } );
const amountExact = ( scaled, unit ) => {
	const f = formatScaled( scaled, unit );
	return { value: f.value, unit, exact: f.exact };
};
const count = ( n ) => {
	if ( n > MAX_COUNT ) {
		throw new CalculationError( 'quantity_too_large' );
	}
	return n;
};
const toInteger = ( value, name ) => {
	if ( typeof value === 'bigint' ) {
		return value;
	}
	if ( typeof value === 'number' && Number.isSafeInteger( value ) ) {
		return BigInt( value );
	}
	throw new TypeError( name + ' must be an integer.' );
};

/**
 * Calculates one line (mirror of Calculator::calculate() + LineResult::to_array()).
 *
 * @param {Object}        line               Line (canonical or raw; validated again).
 * @param {Array}         capacities         Capacity array forms `{dimension, amount, unit, basis}` or Capacity instances.
 * @param {number}        packCount          Containers per purchase unit (1–1000).
 * @param {string}        unitPrice          Canonical decimal display price, or '' (null/undefined treated as '').
 * @param {number}        priceDecimals      Store price decimals (0–8).
 * @param {number|bigint} bundleCoveredUnits Purchase units supplied by a bundle line (≥ 0).
 * @return {Object} Result (same keys and values as LineResult::to_array()).
 */
export function calculateLine( line, capacities, packCount, unitPrice, priceDecimals, bundleCoveredUnits = 0 ) {
	const v = requireLine( line );
	const pack = toInteger( packCount, 'packCount' );
	if ( pack < BigInt( MIN_PACK_COUNT ) || pack > BigInt( MAX_PACK_COUNT ) ) {
		throw new CalculationError( 'invalid_pack_count' );
	}
	priceAssertDecimals( priceDecimals );
	const bundle = toInteger( bundleCoveredUnits, 'bundleCoveredUnits' );
	if ( bundle < 0n ) {
		throw ValidationError.single( 'bundle_covered_units', 'out_of_range' );
	}
	const caps = normalizeCapacities( capacities );
	const price = unitPrice === null || unitPrice === undefined ? '' : unitPrice;
	const unitMinor = price === '' ? null : priceToMinor( price, priceDecimals );
	const priceText = unitMinor === null ? null : priceFromMinor( unitMinor, priceDecimals );

	if ( v.mode === 'manual' ) {
		return calculateManual( v, pack, unitMinor, priceText, priceDecimals );
	}

	if ( caps.length === 0 ) {
		throw new CalculationError( 'no_capacity' );
	}
	const unit = v.unit;
	const dimension = dimensionOf( unit );
	const capacity = pickCapacity( caps, dimension );
	if ( capacity === null ) {
		throw new CalculationError( 'unit_incompatible' );
	}

	const schedule = v.mode === 'schedule';
	const amount = v.amountScaled;
	const eventCount = schedule ? eventCountOf( v ) : null;
	const total = schedule ? mulChecked( amount, eventCount ) : amount;
	const capUnit = mulChecked( capacity.amountScaled, pack );
	const required = count( ceilDiv( total, capUnit ) );
	const covered = bundle < required ? bundle : required;
	const net = required - covered;
	const isOverride = v.override_quantity !== null;
	const quantity = isOverride ? BigInt( v.override_quantity ) : net;
	const stock = count( addChecked( quantity, covered ) );
	const coverage = mulChecked( stock, capUnit );
	const surplus = subChecked( coverage, total );
	const containers = count( mulChecked( quantity, pack ) );
	const eventsCovered = schedule ? count( coverage / amount ) : null;
	const permille = mulDivFloor( coverage, 1000n, total );
	const estimate = unitMinor === null ? null : priceFromMinor( mulChecked( unitMinor, quantity ), priceDecimals );

	// English formula texts: parity with LineResult::to_array() (not built in the browser bundle).
	const formula = [];
	if ( ! CLIENT_BUNDLE ) {
		if ( schedule ) {
			formula.push(
				`${ plural( v.events_per_period, 'event', 'events' ) } per ${ v.period_unit } × ${ plural( v.periods, v.period_unit, v.period_unit + 's' ) } = ${ plural( eventCount, 'event', 'events' ) }`
			);
			formula.push( `${ amountText( amount, unit ) } × ${ plural( eventCount, 'event', 'events' ) } = ${ amountText( total, unit ) }` );
		} else {
			formula.push( 'Total required (entered directly) = ' + amountText( total, unit ) );
		}
		if ( pack > 1n ) {
			formula.push(
				`${ amountText( capacity.amountScaled, capacity.unit ) } per container × ${ pack } containers per unit = ${ amountText( capUnit, capacity.unit ) } per unit`
			);
		}
		formula.push( `⌈${ amountText( total, unit ) } ÷ ${ amountText( capUnit, unit ) } per unit⌉ = ${ unitsText( required ) }` );
		if ( covered > 0n ) {
			formula.push( `${ unitsText( required ) } − ${ unitsText( covered ) } covered by bundle = ${ unitsText( net ) }` );
		}
		if ( isOverride ) {
			formula.push( `Override quantity = ${ unitsText( quantity ) } (recommended ${ unitsText( net ) })` );
		}
		if ( covered > 0n ) {
			formula.push( `${ unitsText( quantity ) } + ${ unitsText( covered ) } from bundle = ${ unitsText( stock ) } in stock` );
		}
		formula.push( `${ unitsText( stock ) } × ${ amountText( capUnit, unit ) } per unit = ${ amountText( coverage, unit ) } coverage` );
		if ( surplus >= 0n ) {
			formula.push( `Surplus = ${ amountText( coverage, unit ) } − ${ amountText( total, unit ) } = ${ amountText( surplus, unit ) }` );
		} else {
			formula.push( `Shortfall = ${ amountText( total, unit ) } − ${ amountText( coverage, unit ) } = ${ amountText( -surplus, unit ) }` );
		}
		if ( pack > 1n ) {
			formula.push( `${ unitsText( quantity ) } × ${ pack } containers per unit = ${ plural( containers, 'container', 'containers' ) }` );
		}
		if ( estimate !== null ) {
			formula.push( `${ unitsText( quantity ) } × ${ priceText } = ${ estimate }` );
		}
	}

	const assumptions = [ notice( capacity.basis === 'usable' ? 'usable_amount_verified' : 'usable_equals_labelled' ) ];
	if ( schedule ) {
		assumptions.push( notice( 'event_count_explicit' ) );
	}
	assumptions.push( notice( 'whole_units_rounded_up' ) );
	if ( pack > 1n ) {
		assumptions.push( notice( 'pack_boundary' ) );
	}
	if ( estimate !== null ) {
		assumptions.push( notice( 'estimate_excludes_tax_shipping_discounts' ) );
	}

	const warnings = [];
	if ( covered > 0n ) {
		warnings.push( notice( 'bundle_coverage_applied' ) );
	}
	if ( isOverride && surplus < 0n ) {
		warnings.push( notice( 'override_shortfall' ) );
	}
	if ( estimate === null ) {
		warnings.push( notice( 'price_unavailable' ) );
	}

	return {
		mode: v.mode,
		dimension,
		unit,
		per_event: schedule ? amountObject( amount, unit ) : null,
		event_count: schedule ? Number( eventCount ) : null,
		events_per_period: schedule ? v.events_per_period : null,
		period_unit: schedule ? v.period_unit : null,
		periods: schedule ? v.periods : null,
		total_required: amountObject( total, unit ),
		capacity: capacity.toArray(),
		pack_count: Number( pack ),
		capacity_per_unit: amountObject( capUnit, capacity.unit ),
		required_units: Number( required ),
		bundle_covered_units: Number( covered ),
		recommended_quantity: Number( net ),
		quantity: Number( quantity ),
		is_override: isOverride,
		containers: Number( containers ),
		coverage: amountObject( coverage, unit ),
		surplus: surplus >= 0n ? amountExact( surplus, unit ) : null,
		shortfall: surplus < 0n ? amountExact( -surplus, unit ) : null,
		surplus_capacity_unit: surplus >= 0n ? amountExact( surplus, capacity.unit ) : null,
		coverage_percent: permilleToPercent( permille ),
		events_covered: schedule ? Number( eventsCovered ) : null,
		unit_price: priceText,
		estimate,
		formula,
		assumptions,
		warnings,
	};
}

/**
 * Manual mode (mirror of Calculator::calculate_manual()).
 *
 * @param {Object}      v             Line values.
 * @param {bigint}      pack          Pack count.
 * @param {bigint|null} unitMinor     Unit price minor units.
 * @param {string|null} priceText     Normalized unit price.
 * @param {number}      priceDecimals Decimals.
 * @return {Object} Result.
 */
function calculateManual( v, pack, unitMinor, priceText, priceDecimals ) {
	const quantity = BigInt( v.manual_quantity );
	const containers = count( mulChecked( quantity, pack ) );
	const estimate = unitMinor === null ? null : priceFromMinor( mulChecked( unitMinor, quantity ), priceDecimals );

	const formula = [];
	if ( ! CLIENT_BUNDLE ) {
		formula.push( 'Manual quantity = ' + unitsText( quantity ) );
		if ( pack > 1n ) {
			formula.push( `${ unitsText( quantity ) } × ${ pack } containers per unit = ${ plural( containers, 'container', 'containers' ) }` );
		}
		if ( estimate !== null ) {
			formula.push( `${ unitsText( quantity ) } × ${ priceText } = ${ estimate }` );
		}
	}
	const assumptions = [];
	if ( pack > 1n ) {
		assumptions.push( notice( 'pack_boundary' ) );
	}
	if ( estimate !== null ) {
		assumptions.push( notice( 'estimate_excludes_tax_shipping_discounts' ) );
	}
	const warnings = [];
	if ( estimate === null ) {
		warnings.push( notice( 'price_unavailable' ) );
	}

	return {
		mode: 'manual',
		dimension: null,
		unit: null,
		per_event: null,
		event_count: null,
		events_per_period: null,
		period_unit: null,
		periods: null,
		total_required: null,
		capacity: null,
		pack_count: Number( pack ),
		capacity_per_unit: null,
		required_units: null,
		bundle_covered_units: 0,
		recommended_quantity: null,
		quantity: Number( quantity ),
		is_override: false,
		containers: Number( containers ),
		coverage: null,
		surplus: null,
		shortfall: null,
		surplus_capacity_unit: null,
		coverage_percent: null,
		events_covered: null,
		unit_price: priceText,
		estimate,
		formula,
		assumptions,
		warnings,
	};
}

/* ------------------------------------------------------------------------------------------------
 * Calendar dates (mirror of InventoryTimeline statics). Pure BigInt integer arithmetic — no Date
 * objects, no time zones, no floats. Public functions accept Number or BigInt and return Numbers.
 * --------------------------------------------------------------------------------------------- */

const bigInt = ( n ) => ( typeof n === 'bigint' ? n : BigInt( n ) );

/**
 * Gregorian leap year.
 *
 * @param {number|bigint} y Year.
 * @return {boolean} Leap year.
 */
export function isLeapYear( y ) {
	const year = bigInt( y );
	return ( year % 4n === 0n && year % 100n !== 0n ) || year % 400n === 0n;
}

/**
 * Days in a month.
 *
 * @param {number|bigint} y Year.
 * @param {number|bigint} m Month 1–12.
 * @return {number} Days.
 */
export function daysInMonth( y, m ) {
	const month = bigInt( m );
	if ( month === 2n ) {
		return isLeapYear( y ) ? 29 : 28;
	}
	return month === 4n || month === 6n || month === 9n || month === 11n ? 30 : 31;
}

/**
 * Parses a strict Y-m-d string that is a real calendar date.
 *
 * @param {string} s Candidate.
 * @return {number[]|null} [year, month, day] or null.
 */
export function parseDate( s ) {
	const m = typeof s === 'string' ? DATE_PATTERN.exec( s ) : null;
	if ( ! m ) {
		return null;
	}
	const y = Number.parseInt( m[ 1 ], 10 );
	const mo = Number.parseInt( m[ 2 ], 10 );
	const d = Number.parseInt( m[ 3 ], 10 );
	if ( mo < 1 || mo > 12 || d < 1 || d > daysInMonth( y, mo ) ) {
		return null;
	}
	return [ y, mo, d ];
}

/**
 * Validation code for an input date, or null when valid (2000-01-01..2100-12-31).
 *
 * @param {string} s Candidate.
 * @return {string|null} invalid_date | out_of_range | null.
 */
export function dateError( s ) {
	if ( parseDate( s ) === null ) {
		return 'invalid_date';
	}
	if ( s < MIN_DATE || s > MAX_DATE ) {
		return 'out_of_range';
	}
	return null;
}

/**
 * Days since 1970-01-01 as BigInt (H. Hinnant's days_from_civil; BigInt division truncates like intdiv).
 *
 * @param {bigint} y Year.
 * @param {bigint} m Month.
 * @param {bigint} d Day.
 * @return {bigint} Days.
 */
function daysFromCivilBig( y, m, d ) {
	const year = y - ( m <= 2n ? 1n : 0n );
	const era = ( year >= 0n ? year : year - 399n ) / 400n;
	const yoe = year - era * 400n;
	const mp = ( m + 9n ) % 12n;
	const doy = ( 153n * mp + 2n ) / 5n + d - 1n;
	const doe = yoe * 365n + yoe / 4n - yoe / 100n + doy;
	return era * 146097n + doe - 719468n;
}

/**
 * Date for days since 1970-01-01 as BigInt parts (H. Hinnant's civil_from_days).
 *
 * @param {bigint} days Days.
 * @return {bigint[]} [year, month, day].
 */
function civilFromDaysBig( days ) {
	const z = days + 719468n;
	const era = ( z >= 0n ? z : z - 146096n ) / 146097n;
	const doe = z - era * 146097n;
	const yoe = ( doe - doe / 1460n + doe / 36524n - doe / 146096n ) / 365n;
	const y = yoe + era * 400n;
	const doy = doe - ( 365n * yoe + yoe / 4n - yoe / 100n );
	const mp = ( 5n * doy + 2n ) / 153n;
	const d = doy - ( 153n * mp + 2n ) / 5n + 1n;
	const m = mp < 10n ? mp + 3n : mp - 9n;
	return [ y + ( m <= 2n ? 1n : 0n ), m, d ];
}

/**
 * Days since 1970-01-01.
 *
 * @param {number|bigint} y Year.
 * @param {number|bigint} m Month.
 * @param {number|bigint} d Day.
 * @return {number} Days.
 */
export function daysFromCivil( y, m, d ) {
	return Number( daysFromCivilBig( bigInt( y ), bigInt( m ), bigInt( d ) ) );
}

/**
 * Date for days since 1970-01-01.
 *
 * @param {number|bigint} z Days.
 * @return {number[]} [year, month, day].
 */
export function civilFromDays( z ) {
	return civilFromDaysBig( bigInt( z ) ).map( Number );
}

/**
 * Formats Y-m-d.
 *
 * @param {number|bigint} y Year.
 * @param {number|bigint} m Month.
 * @param {number|bigint} d Day.
 * @return {string} Date.
 */
export function formatDate( y, m, d ) {
	return String( y ).padStart( 4, '0' ) + '-' + String( m ).padStart( 2, '0' ) + '-' + String( d ).padStart( 2, '0' );
}

/**
 * Adds (or subtracts) days; null outside years 0000–9999.
 *
 * @param {string}        date Valid Y-m-d.
 * @param {number|bigint} days Days (|days| ≤ 70 000 000).
 * @return {string|null} Date.
 */
export function addDays( date, days ) {
	const parts = parseDate( date );
	if ( parts === null || ( typeof days === 'number' && ! Number.isSafeInteger( days ) ) || ( typeof days !== 'number' && typeof days !== 'bigint' ) ) {
		return null;
	}
	const delta = bigInt( days );
	const limit = 7n * BigInt( MAX_DATED_PERIOD_INDEX );
	if ( delta > limit || delta < -limit ) {
		return null;
	}
	const [ y, m, d ] = civilFromDaysBig( daysFromCivilBig( BigInt( parts[ 0 ] ), BigInt( parts[ 1 ] ), BigInt( parts[ 2 ] ) ) + delta );
	return y < 0n || y > BigInt( MAX_YEAR ) ? null : formatDate( y, m, d );
}

/**
 * Adds calendar months, clamping the day to the target month's last day.
 *
 * @param {string}        date   Valid Y-m-d.
 * @param {number|bigint} months Months (0–10 000 000).
 * @return {string|null} Date.
 */
export function addMonths( date, months ) {
	const parts = parseDate( date );
	if ( parts === null || ( typeof months === 'number' && ! Number.isSafeInteger( months ) ) || ( typeof months !== 'number' && typeof months !== 'bigint' ) ) {
		return null;
	}
	const delta = bigInt( months );
	if ( delta < 0n || delta > BigInt( MAX_DATED_PERIOD_INDEX ) ) {
		return null;
	}
	const total = BigInt( parts[ 0 ] ) * 12n + BigInt( parts[ 1 ] - 1 ) + delta;
	const y = total / 12n;
	const m = ( total % 12n ) + 1n;
	if ( y > BigInt( MAX_YEAR ) ) {
		return null;
	}
	const lastDay = daysInMonth( y, m );
	return formatDate( y, m, parts[ 2 ] < lastDay ? parts[ 2 ] : lastDay );
}

/**
 * Start date of period `index` (0-based), always from the original start.
 *
 * @param {string}        start      Valid Y-m-d.
 * @param {string}        periodUnit day | week | month.
 * @param {number|bigint} index      Period index.
 * @return {string|null} Date.
 */
export function periodStart( start, periodUnit, index ) {
	const i = bigInt( index );
	if ( i < 0n || i > BigInt( MAX_DATED_PERIOD_INDEX ) ) {
		return null;
	}
	switch ( periodUnit ) {
		case 'day':
			return addDays( start, i );
		case 'week':
			return addDays( start, 7n * i );
		case 'month':
			return addMonths( start, i );
		default:
			return null;
	}
}

/* ------------------------------------------------------------------------------------------------
 * Inventory timeline (mirror of InventoryTimeline::build()).
 * --------------------------------------------------------------------------------------------- */

/**
 * Builds the inventory timeline of a schedule line.
 *
 * The coverage is recomputed exactly from the result's public fields (quantity,
 * bundle_covered_units, pack_count, capacity), so a result returned by the server can be used too.
 *
 * @param {Object}      line      Line (validated again).
 * @param {Object}      result    calculateLine() result (or the server result for that line).
 * @param {string|null} planStart Plan start (Y-m-d) used when the line has no start date.
 * @return {Object} Timeline (same keys and values as InventoryTimeline::build()).
 */
export function buildTimeline( line, result, planStart ) {
	const v = requireLine( line );
	if ( v.mode !== 'schedule' || ! result || result.mode !== 'schedule' || ! result.capacity || result.coverage === null || result.coverage === undefined ) {
		throw new CalculationError( 'mode_not_allowed' );
	}
	let plan = null;
	if ( planStart !== null && planStart !== undefined && planStart !== '' ) {
		const code = typeof planStart === 'string' ? dateError( planStart ) : 'invalid_date';
		if ( code !== null ) {
			throw ValidationError.single( 'plan_start', code );
		}
		plan = planStart;
	}

	const start = v.start_date ?? plan;
	const unit = v.unit;
	const periodUnit = v.period_unit;
	const periods = v.periods;
	const epp = BigInt( v.events_per_period );
	const amount = v.amountScaled;
	const eventCount = eventCountOf( v );
	const capacity = parseCapacity( result.capacity );
	const pack = toInteger( result.pack_count, 'pack_count' );
	const stockUnits = addChecked( toInteger( result.quantity, 'quantity' ), toInteger( result.bundle_covered_units, 'bundle_covered_units' ) );
	const coverage = mulChecked( stockUnits, mulChecked( capacity.amountScaled, pack ) );
	const stock = mulChecked( stockUnits, pack );
	const eventsCovered = coverage / amount;
	const perPeriod = mulChecked( amount, epp );

	const endDate = start === null ? null : periodStart( start, periodUnit, periods );
	const lastDay = endDate === null ? null : addDays( endDate, -1 );
	const step = periods > MAX_POINTS ? Number( ceilDiv( BigInt( periods ), BigInt( MAX_POINTS ) ) ) : 1;

	const points = [];
	for ( let first = 0; first < periods; first += step ) {
		const last = Math.min( first + step, periods ) - 1;
		const consumed = mulChecked( perPeriod, BigInt( last - first + 1 ) );
		const cumulative = mulChecked( perPeriod, BigInt( last + 1 ) );
		const remaining = subChecked( coverage, cumulative );
		let status = 'short';
		if ( remaining > 0n ) {
			status = 'ok';
		} else if ( remaining === 0n ) {
			status = 'depleted';
		}
		const left = remaining > 0n ? remaining : 0n;
		points.push( {
			index: first,
			date: start === null ? null : periodStart( start, periodUnit, first ),
			label_index: first + 1,
			consumed: formatScaled( consumed, unit ).value,
			remaining: formatScaled( left, unit ).value,
			unit,
			remaining_percent: coverage > 0n ? permilleToPercent( mulDivFloor( left, 1000n, coverage ) ) : '0.0',
			status,
		} );
	}

	const depletions = [];
	const listed = stock < BigInt( MAX_CONTAINERS ) ? stock : BigInt( MAX_CONTAINERS );
	for ( let k = 1n; k <= listed; k++ ) {
		const event = ceilDiv( mulChecked( k, capacity.amountScaled ), amount );
		const periodIndex = ( event - 1n ) / epp;
		depletions.push( {
			container: Number( k ),
			event: Number( event ),
			period_index: Number( periodIndex ),
			date: start === null ? null : periodStart( start, periodUnit, periodIndex ),
			within_plan: event <= eventCount,
		} );
	}

	let runOut = null;
	if ( eventsCovered < eventCount ) {
		const periodIndex = eventsCovered / epp;
		runOut = {
			event: Number( eventsCovered + 1n ),
			period_index: Number( periodIndex ),
			date: start === null ? null : periodStart( start, periodUnit, periodIndex ),
		};
	}

	const reviews = [];
	if ( start !== null ) {
		const review = ( date, type ) => ( { date, type, summary: REVIEW_SUMMARY, line_id: v.id } );
		reviews.push( review( start, 'start' ) );
		const seen = new Set();
		for ( const depletion of depletions ) {
			if ( depletion.within_plan && depletion.date !== null && ! seen.has( depletion.date ) ) {
				seen.add( depletion.date );
				reviews.push( review( depletion.date, 'container_depleted' ) );
			}
		}
		if ( runOut !== null && runOut.date !== null ) {
			reviews.push( review( runOut.date, 'run_out' ) );
		}
		if ( lastDay !== null ) {
			reviews.push( review( lastDay, 'end' ) );
		}
		reviews.sort( ( a, b ) => {
			if ( a.date !== b.date ) {
				return a.date < b.date ? -1 : 1;
			}
			return TYPE_ORDER[ a.type ] - TYPE_ORDER[ b.type ];
		} );
	}

	const assumptions = [];
	if ( periodUnit === 'month' ) {
		assumptions.push( notice( 'calendar_months' ) );
	}
	if ( start !== null ) {
		assumptions.push( notice( 'end_date_exclusive' ) );
	}
	const warnings = [];
	if ( start === null ) {
		warnings.push( notice( 'no_start_date' ) );
	}
	if ( step > 1 ) {
		warnings.push( notice( 'timeline_aggregated' ) );
	}
	if ( stock > BigInt( MAX_CONTAINERS ) ) {
		warnings.push( notice( 'containers_capped' ) );
	}

	return {
		start_date: start,
		end_date: endDate,
		last_day: lastDay,
		period_unit: periodUnit,
		periods,
		granularity: step > 1 ? 'aggregated' : 'period',
		step,
		points,
		depletions,
		run_out: runOut,
		review_events: reviews,
		assumptions,
		warnings,
	};
}

