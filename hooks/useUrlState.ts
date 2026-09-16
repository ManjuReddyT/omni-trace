import { useState, useCallback, useEffect } from 'react';

export function useUrlState<T>(key: string, defaultValue: T): [T, (val: T) => void] {
    const [state, setState] = useState<T>(() => {
        const params = new URLSearchParams(window.location.search);
        const urlVal = params.get(key);
        if (urlVal !== null) {
            try {
                if (typeof defaultValue === 'boolean') {
                    return (urlVal === 'true') as unknown as T;
                }
                if (typeof defaultValue === 'number') {
                    return parseFloat(urlVal) as unknown as T;
                }
                if (Array.isArray(defaultValue)) {
                    return urlVal.split(',').filter(Boolean) as unknown as T;
                }
                return urlVal as unknown as T;
            } catch (e) {
                console.error("Failed to parse URL state", e);
            }
        }
        return defaultValue;
    });

    const setUrlState = useCallback((newValue: T | ((prev: T) => T)) => {
        setState((prev) => {
            const nextValue = typeof newValue === 'function' ? (newValue as (prev: T) => T)(prev) : newValue;
            
            const url = new URL(window.location.href);
            if (nextValue === defaultValue || nextValue === '' || (Array.isArray(nextValue) && nextValue.length === 0)) {
                url.searchParams.delete(key);
            } else if (Array.isArray(nextValue)) {
                url.searchParams.set(key, nextValue.join(','));
            } else {
                url.searchParams.set(key, String(nextValue));
            }
            
            window.history.replaceState({}, '', url.toString());
            return nextValue;
        });
    }, [key, defaultValue]);

    // Handle popstate for browser navigation (back/forward)
    useEffect(() => {
        const handlePopState = () => {
            const params = new URLSearchParams(window.location.search);
            const urlVal = params.get(key);
            if (urlVal !== null) {
                 if (typeof defaultValue === 'boolean') {
                    setState((urlVal === 'true') as unknown as T);
                } else if (typeof defaultValue === 'number') {
                    setState(parseFloat(urlVal) as unknown as T);
                } else if (Array.isArray(defaultValue)) {
                    setState(urlVal.split(',').filter(Boolean) as unknown as T);
                } else {
                    setState(urlVal as unknown as T);
                }
            } else {
                setState(defaultValue);
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [key, defaultValue]);

    return [state, setUrlState];
}
