/**
 * Configuration file for Solidity linter rule presets
 * 
 * This file defines sets of related linting rules that can be toggled as a group,
 * allowing users to easily enable or disable entire categories of linting rules.
 * 
 * For detailed information about each rule, see:
 * https://github.com/protofire/solhint/blob/master/docs/rules.md
 */

/**
 * Style-only rules focusing on code formatting and style conventions
 * 
 * These rules enforce consistent code appearance but don't affect functionality
 * or security. They're useful for maintaining a consistent codebase across a team.
 */
export const STYLE_ONLY_RULES = [
    'quotes',                 // Enforce consistent quote style in strings
    'const-name-snakecase',   // Constants should use SNAKE_CASE
    'func-name-mixedcase',    // Functions should use camelCase
    'contract-name-capwords', // Contracts should use PascalCase
    'var-name-mixedcase',     // Variables should use camelCase
    'visibility-modifier-order', // Consistent order of visibility modifiers
    'imports-order'           // Enforce consistent import ordering
];

/**
 * Naming convention rules enforcing consistent naming patterns
 * 
 * These rules ensure that different Solidity elements follow standard 
 * naming conventions, making code more readable and maintainable.
 */
export const NAMING_CONVENTION_RULES = [
    'const-name-snakecase',   // Constants should use SNAKE_CASE 
    'contract-name-capwords', // Contracts should use PascalCase
    'event-name-capwords',    // Events should use PascalCase
    'func-name-mixedcase',    // Functions should use camelCase
    'func-param-name-mixedcase', // Function parameters should use camelCase
    'interface-starts-with-i', // Interfaces should start with 'I'
    'modifier-name-mixedcase', // Modifiers should use camelCase
    'private-vars-leading-underscore', // Private vars should start with _
    'var-name-mixedcase'      // Variables should use camelCase
];

/**
 * Gas optimization rules to improve contract efficiency
 * 
 * These rules focus on reducing gas consumption, which is important for
 * Ethereum contracts where every operation costs real money in gas fees.
 */
export const GAS_OPTIMIZATION_RULES = [
    'gas-calldata-parameters', // Use calldata for function parameters when possible
    'gas-custom-errors',      // Use custom errors instead of require messages
    'gas-increment-by-one',   // Use ++ instead of += 1 for gas efficiency
    'gas-indexed-events',     // Properly use indexed parameters in events
    'gas-length-in-loops',    // Cache array length in loops
    'gas-multitoken1155',     // Prefer ERC1155 for multiple token types
    'gas-named-return-values', // Use named return values for clearer code
    'gas-small-strings',      // Keep strings under 32 bytes when possible
    'gas-strict-inequalities', // Use strict inequalities for better gas usage
    'gas-struct-packing'      // Pack structs to use fewer storage slots
];

/**
 * Documentation rules enforcing proper code documentation
 * 
 * These rules ensure code is properly documented, making it more
 * maintainable and easier for other developers to understand.
 */
export const DOCUMENTATION_RULES = [
    'reason-string',          // Require reason strings in require/revert
    'func-named-parameters',  // Use named parameters in function calls
    'named-parameters-mapping' // Use named parameters in mapping declarations
];

/**
 * Mapping of preset names to their rule arrays for easy lookup
 * 
 * This allows the extension to easily look up which rules belong to 
 * a specific preset by its identifier.
 */
export const RULE_PRESETS: Record<string, string[]> = {
    'style-only': STYLE_ONLY_RULES,
    'naming-conventions': NAMING_CONVENTION_RULES,
    'gas-optimizations-advanced': GAS_OPTIMIZATION_RULES,
    'documentation-rules': DOCUMENTATION_RULES
};
