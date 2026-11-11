/*
 * Copied unchanged from the owner's "Atlas Research Planner" plugin 1.7.1 (src/app/units.js in the
 * public source map of assets/dist/planner.js; licence GPL-2.0-or-later). The plugin's own header
 * below says engine.js is an exact mirror of the PHP classes behind the live POST /calculate, so
 * running it on the server gives the same results (proved by src/lib/planner/calculate.test.ts).
 * Do not edit: copy a newer version over it instead.
 */
/* eslint no-undef: "error" -- the plugin's own "eslint-disable-next-line no-undef" below expects this rule. */
/**
 * Units, dimensions, strict amount parsing / formatting, stable error types and checked BigInt
 * decimal helpers for the Atlas Research Planner.
 *
 * Exact mirror of includes/Domain/{Units,Decimal,ValidationException,CalculationError}.php.
 * All quantity math uses BigInt; no binary floats are ever used for amounts. ES module, no
 * dependencies. The server result is authoritative; this module only powers instant previews.
 *
 * Quantities are integers in scaled base units: scaled = value_in_base_unit × SCALE (10 000).
 * There is NO conversion between dimensions (mass, activity, volume, actuation, piece).
 *
 * @module units
 */

/** Scale factor of every stored quantity. */
export const SCALE = 10000n;

/** Maximum decimals in the unit entered. */
export const MAX_DECIMALS = 4;

/** Maximum value in the unit entered. */
export const MAX_VALUE = 1000000n;

/** Maximum integer digits of a canonical amount string. */
export const MAX_INTEGER_DIGITS = 9;

/**
 * Largest magnitude any operand or intermediate result may have: 9 × 10^15 (ARCHITECTURE §3.1,
 * identical to Decimal::MAX_TOTAL_SCALED). Below 2^53, so every scaled value is an exact Number.
 */
export const MAX_TOTAL_SCALED = 9000000000000000n;

/** Largest number of decimals supported by toScaled()/fromScaled()/pow10(). */
export const MAX_SCALE_DECIMALS = 18;

/**
 * True only inside the browser bundle: build/build.mjs defines `ARP_CLIENT_BUNDLE` as `true`, so the
 * English message catalogues below and the English formula texts of engine.js are removed from
 * assets/dist/planner.js by dead-code elimination. The planner never shows them (messages.js
 * translates every stable code; explain.js renders the translated formula), while Node (the PHP/JS
 * parity tests) keeps the full English output. Without the define the bundle simply keeps them.
 */
// eslint-disable-next-line no-undef
export const CLIENT_BUNDLE = typeof ARP_CLIENT_BUNDLE !== 'undefined' && ARP_CLIENT_BUNDLE === true;

/** English default messages for validation codes (identical to ValidationException::MESSAGES). */
export const VALIDATION_MESSAGES = Object.freeze( CLIENT_BUNDLE ? {} : {
	unknown_field: 'This field is not recognised.',
	required: 'This field is required.',
	invalid_type: 'This value has the wrong type or format.',
	invalid_number: 'Enter a plain decimal number using digits and an optional decimal point, for example 250 or 0.5.',
	too_many_decimals: 'Use at most 4 decimal places.',
	not_positive: 'The value must be greater than zero.',
	too_large: 'The value is too large.',
	integer_required: 'Enter a whole number.',
	invalid_unit: 'This unit is not supported.',
	invalid_mode: 'Choose schedule, direct or manual mode.',
	invalid_period_unit: 'Choose day, week or month.',
	out_of_range: 'The value is outside the allowed range.',
	invalid_date: 'Enter a real calendar date in the format YYYY-MM-DD.',
	invalid_id: 'The identifier is not valid.',
	too_long: 'The text or list is too long.',
	too_many_lines: 'The plan has too many lines.',
} );

/** Generic message for unknown validation codes. */
export const GENERIC_VALIDATION_MESSAGE = CLIENT_BUNDLE ? '' : 'The value is not valid.';

/** English default messages for calculation codes (identical to CalculationError::MESSAGES). */
export const CALCULATION_MESSAGES = Object.freeze( CLIENT_BUNDLE ? {} : {
	unit_incompatible: 'The selected unit does not match the verified capacity of this product. Mass, activity (IU), volume, actuations and pieces are never converted into each other.',
	no_capacity: 'This product has no verified capacity, so quantities cannot be calculated.',
	quantity_too_large: 'The calculation exceeds the supported size. Reduce the amount, the number of events or the quantity.',
	invalid_pack_count: 'The pack count must be a whole number from 1 to 1000.',
	mode_not_allowed: 'This calculation mode is not available for this line.',
} );

/** Generic message for unknown calculation codes. */
export const GENERIC_CALCULATION_MESSAGE = CLIENT_BUNDLE ? '' : 'The calculation could not be completed.';

/** English default messages for warning and assumption codes (identical to LineResult::NOTICES). */
export const NOTICE_MESSAGES = Object.freeze( CLIENT_BUNDLE ? {} : {
	price_unavailable: 'No current store price is available, so no estimate is shown.',
	override_shortfall: 'The chosen quantity does not cover the total required amount.',
	bundle_coverage_applied: 'Units supplied by a bundle in this plan were subtracted from the required quantity.',
	timeline_aggregated: 'The timeline groups several periods into each point.',
	no_start_date: 'No start date was entered, so the timeline uses relative periods and no review dates are created.',
	containers_capped: 'Only the first 500 containers are listed individually.',
	out_of_stock: 'This item is currently out of stock.',
	on_backorder: 'This item is currently on backorder.',
	price_hidden: 'Price estimates are hidden by the store.',
	usable_equals_labelled: 'The labelled amount per container is treated as fully usable.',
	usable_amount_verified: 'The calculation uses the merchant-verified usable amount per container.',
	event_count_explicit: 'Event count = events per period × number of periods, exactly as entered.',
	whole_units_rounded_up: 'Quantities are rounded up to whole purchase units.',
	pack_boundary: 'Each purchase unit contains several containers; quantities are counted in whole purchase units.',
	calendar_months: 'Monthly periods follow calendar months; when the start day does not exist in a month, the last day of that month is used.',
	end_date_exclusive: 'The end date is the first day after the plan; the last day of the plan is the day before it.',
	estimate_excludes_tax_shipping_discounts: 'Estimates use current store prices and exclude shipping, taxes and discounts.',
} );

const hasOwn = ( object, key ) => Object.prototype.hasOwnProperty.call( object, key );

/**
 * English message for a validation code.
 *
 * @param {string} code Stable code.
 * @return {string} Message.
 */
export function validationMessage( code ) {
	return hasOwn( VALIDATION_MESSAGES, code ) ? VALIDATION_MESSAGES[ code ] : GENERIC_VALIDATION_MESSAGE;
}

/**
 * English message for a calculation code.
 *
 * @param {string} code Stable code.
 * @return {string} Message.
 */
export function calculationMessage( code ) {
	return hasOwn( CALCULATION_MESSAGES, code ) ? CALCULATION_MESSAGES[ code ] : GENERIC_CALCULATION_MESSAGE;
}

/**
 * `{code, message}` for a warning or assumption code.
 *
 * @param {string} code Stable code.
 * @return {{code: string, message: string}} Notice.
 */
export function notice( code ) {
	return { code, message: hasOwn( NOTICE_MESSAGES, code ) ? NOTICE_MESSAGES[ code ] : code };
}

/**
 * One validation error entry.
 *
 * @param {string} field Field name.
 * @param {string} code  Stable code.
 * @return {{field: string, code: string, message: string}} Entry.
 */
export function validationEntry( field, code ) {
	return { field, code, message: validationMessage( code ) };
}

/**
 * Validation failure carrying field-specific errors (mirror of ValidationException).
 */
export class ValidationError extends Error {
	/**
	 * @param {Array<{field?: string, code?: string, message?: string}>} errors Errors.
	 */
	constructor( errors ) {
		const normalized = [];
		for ( const error of Array.isArray( errors ) ? errors : [] ) {
			if ( ! error || typeof error !== 'object' ) {
				continue;
			}
			const field = typeof error.field === 'string' ? error.field : '';
			const code = typeof error.code === 'string' ? error.code : 'invalid_type';
			const message = typeof error.message === 'string' && error.message !== '' ? error.message : validationMessage( code );
			normalized.push( { field, code, message } );
		}
		if ( normalized.length === 0 ) {
			normalized.push( validationEntry( '', 'invalid_type' ) );
		}
		const codes = [ ...new Set( normalized.map( ( e ) => e.code ) ) ];
		super( 'Validation failed: ' + codes.join( ', ' ) );
		this.name = 'ValidationError';
		this.errors = normalized;
		this.code = normalized[ 0 ].code;
	}

	/**
	 * Convenience factory for one error.
	 *
	 * @param {string} field Field.
	 * @param {string} code  Code.
	 * @return {ValidationError} Error.
	 */
	static single( field, code ) {
		return new ValidationError( [ validationEntry( field, code ) ] );
	}

	/** @return {string} Code of the first error. */
	firstCode() {
		return this.errors[ 0 ].code;
	}

	/** @return {string[]} All codes in order. */
	codes() {
		return this.errors.map( ( e ) => e.code );
	}
}

/**
 * Calculation error with a stable code (mirror of CalculationError).
 */
export class CalculationError extends Error {
	/**
	 * @param {string} code    Stable code.
	 * @param {string} message Optional English message.
	 */
	constructor( code, message = '' ) {
		super( message !== '' ? message : calculationMessage( code ) );
		this.name = 'CalculationError';
		this.code = code;
	}

	/** @return {{code: string, message: string}} Public representation. */
	toArray() {
		return { code: this.code, message: this.message };
	}
}

/* ------------------------------------------------------------------------------------------------
 * Checked BigInt decimal helpers (mirror of Domain\Decimal).
 * --------------------------------------------------------------------------------------------- */

const CANONICAL_PATTERN = /^([0-9]+)(?:\.([0-9]+))?$/;

const toBig = ( n ) => {
	if ( typeof n === 'bigint' ) {
		return n;
	}
	if ( typeof n === 'number' && Number.isSafeInteger( n ) ) {
		return BigInt( n );
	}
	throw new TypeError( 'Expected an integer (BigInt or safe integer Number).' );
};

const assertDecimals = ( decimals ) => {
	if ( ! Number.isInteger( decimals ) || decimals < 0 || decimals > MAX_SCALE_DECIMALS ) {
		throw new RangeError( 'Decimals must be between 0 and 18.' );
	}
};

const assertDivisor = ( b ) => {
	if ( b <= 0n ) {
		throw new RangeError( 'Divisor must be positive.' );
	}
};

/**
 * Throws `quantity_too_large` when |n| exceeds MAX_TOTAL_SCALED.
 *
 * @param {bigint} n Value.
 */
export function assertBounded( n ) {
	if ( n > MAX_TOTAL_SCALED || n < -MAX_TOTAL_SCALED ) {
		throw new CalculationError( 'quantity_too_large' );
	}
}

/**
 * Whether a string is a canonical decimal (ASCII digits, optional fraction).
 *
 * @param {string} s Candidate.
 * @return {boolean} Canonical.
 */
export function isCanonical( s ) {
	return typeof s === 'string' && CANONICAL_PATTERN.test( s );
}

/**
 * 10^n as BigInt (0 ≤ n ≤ 18).
 *
 * @param {number} n Exponent.
 * @return {bigint} Power.
 */
export function pow10( n ) {
	assertDecimals( n );
	return 10n ** BigInt( n );
}

/**
 * Checked multiplication.
 *
 * @param {bigint} a Factor.
 * @param {bigint} b Factor.
 * @return {bigint} Product.
 */
export function mulChecked( a, b ) {
	a = toBig( a );
	b = toBig( b );
	assertBounded( a );
	assertBounded( b );
	const r = a * b;
	assertBounded( r );
	return r;
}

/**
 * Checked addition.
 *
 * @param {bigint} a Addend.
 * @param {bigint} b Addend.
 * @return {bigint} Sum.
 */
export function addChecked( a, b ) {
	a = toBig( a );
	b = toBig( b );
	assertBounded( a );
	assertBounded( b );
	const r = a + b;
	assertBounded( r );
	return r;
}

/**
 * Checked subtraction.
 *
 * @param {bigint} a Minuend.
 * @param {bigint} b Subtrahend.
 * @return {bigint} Difference.
 */
export function subChecked( a, b ) {
	b = toBig( b );
	assertBounded( b );
	return addChecked( a, -b );
}

/**
 * Ceiling division for a positive divisor.
 *
 * @param {bigint} a Dividend.
 * @param {bigint} b Divisor (> 0).
 * @return {bigint} Quotient.
 */
export function ceilDiv( a, b ) {
	a = toBig( a );
	b = toBig( b );
	assertDivisor( b );
	let q = a / b;
	if ( a % b !== 0n && a > 0n ) {
		q += 1n;
	}
	return q;
}

/**
 * Floor division for a positive divisor.
 *
 * @param {bigint} a Dividend.
 * @param {bigint} b Divisor (> 0).
 * @return {bigint} Quotient.
 */
export function floorDiv( a, b ) {
	a = toBig( a );
	b = toBig( b );
	assertDivisor( b );
	let q = a / b;
	if ( a % b !== 0n && a < 0n ) {
		q -= 1n;
	}
	return q;
}

/**
 * Division rounded half-up (ties away from zero) for a positive divisor.
 *
 * @param {bigint} a Dividend.
 * @param {bigint} b Divisor (> 0).
 * @return {bigint} Rounded quotient.
 */
export function roundHalfUpDiv( a, b ) {
	a = toBig( a );
	b = toBig( b );
	assertDivisor( b );
	assertBounded( a );
	const negative = a < 0n;
	const abs = negative ? -a : a;
	let q = abs / b;
	const r = abs % b;
	if ( r >= b - r ) {
		q += 1n;
	}
	return negative ? -q : q;
}

/**
 * floor( a × b ÷ c ) for non-negative a, b and positive c.
 *
 * @param {bigint} a Non-negative factor.
 * @param {bigint} b Non-negative factor.
 * @param {bigint} c Positive divisor.
 * @return {bigint} Result.
 */
export function mulDivFloor( a, b, c ) {
	a = toBig( a );
	b = toBig( b );
	c = toBig( c );
	assertDivisor( c );
	assertBounded( a );
	assertBounded( b );
	if ( a < 0n || b < 0n ) {
		throw new RangeError( 'mulDivFloor() expects non-negative factors.' );
	}
	const r = ( a * b ) / c;
	assertBounded( r );
	return r;
}

/**
 * Converts a canonical decimal string to an integer scaled by 10^decimals.
 *
 * @param {string} s        Canonical decimal.
 * @param {number} decimals Allowed decimals (0–18).
 * @return {bigint} Scaled value.
 */
export function toScaled( s, decimals ) {
	assertDecimals( decimals );
	const m = typeof s === 'string' ? CANONICAL_PATTERN.exec( s ) : null;
	if ( ! m ) {
		throw ValidationError.single( 'value', 'invalid_number' );
	}
	const frac = m[ 2 ] ?? '';
	if ( frac.length > decimals ) {
		throw ValidationError.single( 'value', 'too_many_decimals' );
	}
	const fracValue = frac === '' ? 0n : BigInt( frac.padEnd( decimals, '0' ) );
	assertBounded( fracValue );
	const intValue = intFromDigits( m[ 1 ] );
	if ( intValue === 0n ) {
		return fracValue;
	}
	return addChecked( mulChecked( intValue, pow10( decimals ) ), fracValue );
}

/**
 * Converts ASCII digits (no sign) to a BigInt ≤ MAX_TOTAL_SCALED (mirror of Decimal::int_from_digits()).
 *
 * @param {string} digits ASCII digits (may be empty or have leading zeros).
 * @return {bigint} Value.
 */
export function intFromDigits( digits ) {
	if ( typeof digits !== 'string' || ! /^[0-9]*$/.test( digits ) ) {
		throw new RangeError( 'intFromDigits() expects ASCII digits.' );
	}
	const stripped = digits.replace( /^0+/, '' );
	if ( stripped === '' ) {
		return 0n;
	}
	const max = MAX_TOTAL_SCALED.toString();
	if ( stripped.length > max.length || ( stripped.length === max.length && stripped > max ) ) {
		throw new CalculationError( 'quantity_too_large' );
	}
	return BigInt( stripped );
}

/**
 * Formats a scaled integer with exactly `decimals` places.
 *
 * @param {bigint} n        Scaled integer.
 * @param {number} decimals Decimal places (0–18).
 * @return {string} Decimal string.
 */
export function fromScaled( n, decimals ) {
	n = toBig( n );
	assertDecimals( decimals );
	assertBounded( n );
	const negative = n < 0n;
	let digits = ( negative ? -n : n ).toString();
	const sign = negative ? '-' : '';
	if ( decimals === 0 ) {
		return sign + digits;
	}
	digits = digits.padStart( decimals + 1, '0' );
	return sign + digits.slice( 0, -decimals ) + '.' + digits.slice( -decimals );
}

/**
 * Removes trailing fractional zeros ("1.5000" → "1.5", "2.000" → "2").
 *
 * @param {string} s Decimal string.
 * @return {string} Trimmed string.
 */
export function trimZeros( s ) {
	if ( ! s.includes( '.' ) ) {
		return s;
	}
	const trimmed = s.replace( /0+$/, '' ).replace( /\.$/, '' );
	return trimmed === '-0' ? '0' : trimmed;
}

/**
 * Formats a non-negative permille as a percentage with one (truncated) decimal.
 *
 * @param {bigint} permille Permille.
 * @return {string} Percentage, e.g. "125.0".
 */
export function permilleToPercent( permille ) {
	permille = toBig( permille );
	if ( permille < 0n ) {
		throw new RangeError( 'permilleToPercent() expects a non-negative value.' );
	}
	return ( permille / 10n ).toString() + '.' + ( permille % 10n ).toString();
}

/* ------------------------------------------------------------------------------------------------
 * Units (mirror of Domain\Units).
 * --------------------------------------------------------------------------------------------- */

/** Dimensions: base unit, units with BigInt factor to base, integer-only flag. */
export const DIMENSIONS = Object.freeze( {
	mass: Object.freeze( { base: 'mcg', units: Object.freeze( { mcg: 1n, mg: 1000n, g: 1000000n } ), integer: false } ),
	activity: Object.freeze( { base: 'IU', units: Object.freeze( { IU: 1n } ), integer: false } ),
	volume: Object.freeze( { base: 'mL', units: Object.freeze( { mL: 1n } ), integer: false } ),
	actuation: Object.freeze( { base: 'actuation', units: Object.freeze( { actuation: 1n } ), integer: true } ),
	piece: Object.freeze( { base: 'piece', units: Object.freeze( { piece: 1n } ), integer: true } ),
} );

/** Canonical units in display order. */
export const UNITS = Object.freeze( [ 'mcg', 'mg', 'g', 'IU', 'mL', 'actuation', 'piece' ] );

/** Accepted aliases → canonical unit (exact, case-sensitive match; µ as U+00B5 or U+03BC). */
export const ALIASES = Object.freeze( {
	'µg': 'mcg',
	'μg': 'mcg',
	ug: 'mcg',
	ml: 'mL',
	ML: 'mL',
	iu: 'IU',
	Iu: 'IU',
	actuations: 'actuation',
	spray: 'actuation',
	sprays: 'actuation',
	pieces: 'piece',
	pcs: 'piece',
	pc: 'piece',
} );

const UNIT_DIMENSION = new Map();
const UNIT_FACTOR = new Map();
for ( const [ dimension, definition ] of Object.entries( DIMENSIONS ) ) {
	for ( const [ unit, unitFactor ] of Object.entries( definition.units ) ) {
		UNIT_DIMENSION.set( unit, dimension );
		UNIT_FACTOR.set( unit, unitFactor );
	}
}
const ALIAS_MAP = new Map( Object.entries( ALIASES ) );

const LOOSE_PATTERN = /^(-?)([0-9]+)(?:\.([0-9]+))?$/;

/**
 * Canonical unit for a unit or alias; null when unsupported.
 *
 * @param {string} u Unit as entered.
 * @return {string|null} Canonical unit.
 */
export function normalizeUnit( u ) {
	if ( typeof u !== 'string' ) {
		return null;
	}
	if ( UNIT_DIMENSION.has( u ) ) {
		return u;
	}
	return ALIAS_MAP.has( u ) ? ALIAS_MAP.get( u ) : null;
}

/**
 * Dimension of a unit or alias; null when unsupported.
 *
 * @param {string} unit Unit.
 * @return {string|null} Dimension.
 */
export function dimensionOf( unit ) {
	const canonical = normalizeUnit( unit );
	return canonical === null ? null : UNIT_DIMENSION.get( canonical );
}

/**
 * Factor from the unit to its base unit.
 *
 * @param {string} unit Unit or alias.
 * @return {bigint} Factor.
 */
export function factor( unit ) {
	const canonical = normalizeUnit( unit );
	if ( canonical === null ) {
		throw ValidationError.single( 'unit', 'invalid_unit' );
	}
	return UNIT_FACTOR.get( canonical );
}

/**
 * Base unit of a dimension.
 *
 * @param {string} dimension Dimension.
 * @return {string} Base unit.
 */
export function baseUnit( dimension ) {
	if ( typeof dimension !== 'string' || ! hasOwn( DIMENSIONS, dimension ) ) {
		throw ValidationError.single( 'dimension', 'invalid_unit' );
	}
	return DIMENSIONS[ dimension ].base;
}

/**
 * Whether a dimension key exists.
 *
 * @param {string} dimension Dimension.
 * @return {boolean} Known.
 */
export function isDimension( dimension ) {
	return typeof dimension === 'string' && hasOwn( DIMENSIONS, dimension );
}

/**
 * Whether the unit only accepts whole numbers (actuation, piece).
 *
 * @param {string} unit Unit or alias.
 * @return {boolean} Integer-only.
 */
export function isIntegerUnit( unit ) {
	const dimension = dimensionOf( unit );
	return dimension !== null && DIMENSIONS[ dimension ].integer;
}

/**
 * Classifies an amount string; null when valid (grammar, sign, decimals, magnitude).
 *
 * @param {string} value Amount string.
 * @return {string|null} Code or null.
 */
export function decimalError( value ) {
	const m = typeof value === 'string' ? LOOSE_PATTERN.exec( value ) : null;
	if ( ! m ) {
		return 'invalid_number';
	}
	if ( m[ 1 ] === '-' ) {
		return 'not_positive';
	}
	const frac = m[ 3 ] ?? '';
	if ( frac.length > MAX_DECIMALS ) {
		return 'too_many_decimals';
	}
	const int = m[ 2 ].replace( /^0+/, '' );
	if ( m[ 2 ].length > MAX_INTEGER_DIGITS ) {
		return int.length > 7 ? 'too_large' : 'invalid_number';
	}
	const intValue = int === '' ? 0n : BigInt( int );
	const fracValue = frac === '' ? 0n : BigInt( frac );
	if ( intValue === 0n && fracValue === 0n ) {
		return 'not_positive';
	}
	if ( intValue > MAX_VALUE || ( intValue === MAX_VALUE && fracValue > 0n ) ) {
		return 'too_large';
	}
	return null;
}

/**
 * Parses an amount string into BigInt scaled by SCALE in the entered unit (no unit check).
 *
 * @param {string} value Amount string.
 * @param {string} field Field name for errors.
 * @return {bigint} Value × 10^4 in the entered unit.
 */
export function parseDecimal( value, field = 'amount' ) {
	const code = decimalError( value );
	if ( code !== null ) {
		throw ValidationError.single( field, code );
	}
	const m = LOOSE_PATTERN.exec( value );
	const int = m[ 2 ].replace( /^0+/, '' );
	const frac = m[ 3 ] ?? '';
	return ( int === '' ? 0n : BigInt( int ) ) * SCALE + ( frac === '' ? 0n : BigInt( frac.padEnd( MAX_DECIMALS, '0' ) ) );
}

/**
 * Parses an amount entered in `unit` into scaled BASE units (mirror of Units::parse()).
 *
 * @param {string} str  Amount string (canonical decimal).
 * @param {string} unit Unit or alias.
 * @return {bigint} Scaled base quantity.
 */
export function parseAmount( str, unit ) {
	const errors = [];
	const canonical = normalizeUnit( unit );
	const code = decimalError( str );
	if ( code !== null ) {
		errors.push( validationEntry( 'amount', code ) );
	} else if ( canonical !== null && isIntegerUnit( canonical ) && parseDecimal( str ) % SCALE !== 0n ) {
		errors.push( validationEntry( 'amount', 'integer_required' ) );
	}
	if ( canonical === null ) {
		errors.push( validationEntry( 'unit', 'invalid_unit' ) );
	}
	if ( errors.length > 0 ) {
		throw new ValidationError( errors );
	}
	return parseDecimal( str ) * factor( canonical );
}

/**
 * Canonical (trimmed) representation of a valid amount ("0.50" → "0.5", "007" → "7").
 *
 * @param {string} value Amount string.
 * @return {string} Canonical amount.
 */
export function canonicalAmount( value ) {
	return trimZeros( fromScaled( parseDecimal( value ), MAX_DECIMALS ) );
}

/**
 * Formats a scaled base quantity in `unit` (exact, or rounded half-up to 4 decimals).
 *
 * @param {bigint} scaled Scaled base quantity.
 * @param {string} unit   Unit or alias.
 * @return {{value: string, exact: boolean}} Formatted value.
 */
export function formatScaled( scaled, unit ) {
	scaled = toBig( scaled );
	const unitFactor = factor( unit );
	const exact = scaled % unitFactor === 0n;
	const inUnit = exact ? scaled / unitFactor : roundHalfUpDiv( scaled, unitFactor );
	return { value: trimZeros( fromScaled( inUnit, MAX_DECIMALS ) ), exact };
}

/**
 * Units a user may choose for the given dimensions (canonical order).
 *
 * @param {string[]} dimensions Dimension keys.
 * @return {string[]} Units.
 */
export function compatibleUnits( dimensions ) {
	const wanted = Array.isArray( dimensions ) ? dimensions : [];
	const units = [];
	for ( const [ dimension, definition ] of Object.entries( DIMENSIONS ) ) {
		if ( wanted.includes( dimension ) ) {
			units.push( ...Object.keys( definition.units ) );
		}
	}
	return units;
}

/**
 * Dimension catalogue.
 *
 * @return {typeof DIMENSIONS} Dimensions.
 */
export function dimensions() {
	return DIMENSIONS;
}
