/**
 * Input Validation Module
 * Implements comprehensive input validation and sanitization
 */

import * as path from 'path';
import * as fs from 'fs';
import { ValidationError, ErrorCodes, assertValid } from '../errors';

// Type guards for primitive validation
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

export function isPositiveNumber(value: unknown): value is number {
  return isNumber(value) && value > 0;
}

export function isNonNegativeNumber(value: unknown): value is number {
  return isNumber(value) && value >= 0;
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

export function isDate(value: unknown): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}

// String validation utilities
export function isNonEmptyString(value: unknown): value is string {
  return isString(value) && value.trim().length > 0;
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidPath(filePath: string): boolean {
  try {
    // Prevent path traversal attacks
    const normalized = path.normalize(filePath);
    const resolved = path.resolve(filePath);
    
    // Check for common attack patterns
    if (filePath.includes('\0')) return false;
    if (filePath.includes('..')) {
      // Allow relative paths but check they resolve to expected location
      const cwd = process.cwd();
      if (!resolved.startsWith(cwd) && !path.isAbsolute(filePath)) {
        return false;
      }
    }
    
    return true;
  } catch {
    return false;
  }
}

export function isValidGitRepository(repoPath: string): boolean {
  if (!isValidPath(repoPath)) return false;
  
  try {
    const gitDir = path.join(repoPath, '.git');
    return fs.existsSync(gitDir) && fs.statSync(gitDir).isDirectory();
  } catch {
    return false;
  }
}

// Sanitization functions
export function sanitizeString(input: string, maxLength: number = 10000): string {
  return input
    .slice(0, maxLength)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control chars except newline/tab
    .trim();
}

export function sanitizePath(filePath: string): string {
  return path.normalize(filePath).replace(/\0/g, '');
}

export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim().slice(0, 254);
}

export function maskSensitiveData(data: string, visibleChars: number = 4): string {
  if (data.length <= visibleChars * 2) {
    return '*'.repeat(data.length);
  }
  return `${data.slice(0, visibleChars)}${'*'.repeat(data.length - visibleChars * 2)}${data.slice(-visibleChars)}`;
}

// Schema validation
export interface ValidationSchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'date';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: unknown[];
  items?: ValidationSchema;
  properties?: Record<string, ValidationSchema>;
  custom?: (value: unknown) => boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: Array<{
    field: string;
    message: string;
    value?: unknown;
  }>;
}

export function validateSchema(
  data: unknown,
  schema: ValidationSchema,
  fieldName: string = 'value'
): ValidationResult {
  const errors: ValidationResult['errors'] = [];

  // Handle null/undefined
  if (data === null || data === undefined) {
    if (schema.required) {
      errors.push({ field: fieldName, message: `${fieldName} is required` });
    }
    return { valid: errors.length === 0, errors };
  }

  // Type validation
  switch (schema.type) {
    case 'string':
      if (!isString(data)) {
        errors.push({ field: fieldName, message: `${fieldName} must be a string`, value: data });
      } else {
        if (schema.minLength !== undefined && data.length < schema.minLength) {
          errors.push({ field: fieldName, message: `${fieldName} must be at least ${schema.minLength} characters` });
        }
        if (schema.maxLength !== undefined && data.length > schema.maxLength) {
          errors.push({ field: fieldName, message: `${fieldName} must be at most ${schema.maxLength} characters` });
        }
        if (schema.pattern && !schema.pattern.test(data)) {
          errors.push({ field: fieldName, message: `${fieldName} has invalid format` });
        }
        if (schema.enum && !schema.enum.includes(data)) {
          errors.push({ field: fieldName, message: `${fieldName} must be one of: ${schema.enum.join(', ')}` });
        }
      }
      break;

    case 'number':
      if (!isNumber(data)) {
        errors.push({ field: fieldName, message: `${fieldName} must be a number`, value: data });
      } else {
        if (schema.min !== undefined && data < schema.min) {
          errors.push({ field: fieldName, message: `${fieldName} must be at least ${schema.min}` });
        }
        if (schema.max !== undefined && data > schema.max) {
          errors.push({ field: fieldName, message: `${fieldName} must be at most ${schema.max}` });
        }
      }
      break;

    case 'boolean':
      if (!isBoolean(data)) {
        errors.push({ field: fieldName, message: `${fieldName} must be a boolean`, value: data });
      }
      break;

    case 'object':
      if (!isObject(data)) {
        errors.push({ field: fieldName, message: `${fieldName} must be an object`, value: data });
      } else if (schema.properties) {
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          const propResult = validateSchema(data[key], propSchema, `${fieldName}.${key}`);
          errors.push(...propResult.errors);
        }
      }
      break;

    case 'array':
      if (!isArray(data)) {
        errors.push({ field: fieldName, message: `${fieldName} must be an array`, value: data });
      } else {
        if (schema.minLength !== undefined && data.length < schema.minLength) {
          errors.push({ field: fieldName, message: `${fieldName} must have at least ${schema.minLength} items` });
        }
        if (schema.maxLength !== undefined && data.length > schema.maxLength) {
          errors.push({ field: fieldName, message: `${fieldName} must have at most ${schema.maxLength} items` });
        }
        if (schema.items) {
          data.forEach((item, index) => {
            const itemResult = validateSchema(item, schema.items!, `${fieldName}[${index}]`);
            errors.push(...itemResult.errors);
          });
        }
      }
      break;

    case 'date':
      if (!isDate(data) && !(isString(data) && !isNaN(Date.parse(data)))) {
        errors.push({ field: fieldName, message: `${fieldName} must be a valid date`, value: data });
      }
      break;
  }

  // Custom validation
  if (errors.length === 0 && schema.custom && !schema.custom(data)) {
    errors.push({ field: fieldName, message: `${fieldName} failed custom validation`, value: data });
  }

  return { valid: errors.length === 0, errors };
}

// Specific validators for domain objects
export interface RepositoryPathValidation {
  valid: boolean;
  absolutePath: string;
  errors: string[];
}

export function validateRepositoryPath(repoPath: unknown): RepositoryPathValidation {
  const errors: string[] = [];

  if (!isNonEmptyString(repoPath)) {
    return {
      valid: false,
      absolutePath: '',
      errors: ['Repository path must be a non-empty string'],
    };
  }

  const sanitized = sanitizePath(repoPath);
  const absolutePath = path.resolve(sanitized);

  if (!fs.existsSync(absolutePath)) {
    errors.push(`Path does not exist: ${absolutePath}`);
  } else if (!fs.statSync(absolutePath).isDirectory()) {
    errors.push(`Path is not a directory: ${absolutePath}`);
  } else if (!isValidGitRepository(absolutePath)) {
    errors.push(`Path is not a git repository: ${absolutePath}`);
  }

  return {
    valid: errors.length === 0,
    absolutePath,
    errors,
  };
}

export function validateContributorEmail(email: unknown): string {
  assertValid(
    isNonEmptyString(email),
    ErrorCodes.VAL_003,
    'Contributor email must be a non-empty string',
    { field: 'email', value: email }
  );

  const sanitized = sanitizeEmail(email);
  
  assertValid(
    isValidEmail(sanitized),
    ErrorCodes.VAL_003,
    'Invalid email format',
    { field: 'email', value: sanitized }
  );

  return sanitized;
}

export function validateContributionScore(score: unknown): number {
  assertValid(
    isNumber(score),
    ErrorCodes.VAL_008,
    'Contribution score must be a number',
    { field: 'score', value: score }
  );

  assertValid(
    score >= 0 && score <= 100,
    ErrorCodes.VAL_008,
    'Contribution score must be between 0 and 100',
    { field: 'score', value: score }
  );

  return score;
}

export function validateOutputFormat(format: unknown): 'json' | 'yaml' | 'markdown' {
  const validFormats = ['json', 'yaml', 'markdown'] as const;
  
  assertValid(
    isString(format) && validFormats.includes(format as typeof validFormats[number]),
    ErrorCodes.VAL_005,
    `Invalid output format. Must be one of: ${validFormats.join(', ')}`,
    { field: 'format', value: format }
  );

  return format as 'json' | 'yaml' | 'markdown';
}

export function validateTotalValue(value: unknown): number {
  assertValid(
    isPositiveNumber(value),
    ErrorCodes.VAL_006,
    'Total value must be a positive number',
    { field: 'totalValue', value }
  );

  return value;
}

export function validateDateRange(
  start: unknown,
  end: unknown
): { start: Date; end: Date } {
  const startDate = start instanceof Date ? start : new Date(start as string);
  const endDate = end instanceof Date ? end : new Date(end as string);

  assertValid(
    isDate(startDate),
    ErrorCodes.VAL_007,
    'Invalid start date',
    { field: 'startDate', value: start }
  );

  assertValid(
    isDate(endDate),
    ErrorCodes.VAL_007,
    'Invalid end date',
    { field: 'endDate', value: end }
  );

  assertValid(
    startDate <= endDate,
    ErrorCodes.VAL_007,
    'Start date must be before or equal to end date',
    { field: 'dateRange', value: { start, end } }
  );

  return { start: startDate, end: endDate };
}

// Environment variable validation
export function requireEnvVar(name: string): string {
  const value = process.env[name];
  
  if (!value || value.trim() === '') {
    throw new ValidationError(
      ErrorCodes.CFG_003,
      `Required environment variable ${name} is not set`,
      { field: name }
    );
  }

  return value.trim();
}

export function getEnvVar(name: string, defaultValue: string): string {
  const value = process.env[name];
  return value && value.trim() !== '' ? value.trim() : defaultValue;
}

export function getEnvVarAsNumber(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (!value) return defaultValue;
  
  const parsed = parseFloat(value);
  return isNumber(parsed) ? parsed : defaultValue;
}

export function getEnvVarAsBoolean(name: string, defaultValue: boolean): boolean {
  const value = process.env[name]?.toLowerCase();
  if (!value) return defaultValue;
  
  if (['true', '1', 'yes', 'on'].includes(value)) return true;
  if (['false', '0', 'no', 'off'].includes(value)) return false;
  return defaultValue;
}
