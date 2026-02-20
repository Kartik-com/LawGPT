import { z } from 'zod';

/**
 * Zod-based request validation middleware factory.
 * @param {object} schemas - { body?, params?, query? } — each a Zod schema
 */
export function validate({ body, params, query } = {}) {
    return (req, res, next) => {
        const errors = [];

        if (body) {
            const result = body.safeParse(req.body);
            if (!result.success) {
                errors.push(
                    ...(result.error.issues ?? []).map(e => ({
                        field: (e.path ?? []).join('.'),
                        message: e.message,
                        location: 'body',
                    }))
                );
            } else {
                req.body = result.data; // Use parsed/coerced value
            }
        }

        if (params) {
            const result = params.safeParse(req.params);
            if (!result.success) {
                errors.push(
                    ...(result.error.issues ?? []).map(e => ({
                        field: (e.path ?? []).join('.'),
                        message: e.message,
                        location: 'params',
                    }))
                );
            }
        }

        if (query) {
            const result = query.safeParse(req.query);
            if (!result.success) {
                errors.push(
                    ...(result.error.issues ?? []).map(e => ({
                        field: (e.path ?? []).join('.'),
                        message: e.message,
                        location: 'query',
                    }))
                );
            } else {
                req.query = result.data;
            }
        }

        if (errors.length > 0) {
            return res.status(400).json({
                error: 'Validation Error',
                message: errors[0].message,
                details: errors,
            });
        }

        next();
    };
}
