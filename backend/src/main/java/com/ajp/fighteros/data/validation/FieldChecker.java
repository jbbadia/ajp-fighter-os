package com.ajp.fighteros.data.validation;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Fluent checks over a JSON object (as a Map). Errors are collected per field path
 * so the client can show them next to the right input.
 */
public final class FieldChecker {

    private static final Pattern TIME = Pattern.compile("^([01]\\d|2[0-3]):[0-5]\\d$");
    private static final Pattern URL = Pattern.compile("^https?://\\S+$", Pattern.CASE_INSENSITIVE);

    private final Map<String, Object> obj;
    private final String prefix;
    private final Map<String, String> errors;

    public FieldChecker(Map<String, Object> obj) {
        this(obj, "", new LinkedHashMap<>());
    }

    private FieldChecker(Map<String, Object> obj, String prefix, Map<String, String> errors) {
        this.obj = obj;
        this.prefix = prefix;
        this.errors = errors;
    }

    public Map<String, String> errors() {
        return errors;
    }

    private void error(String field, String message) {
        errors.putIfAbsent(prefix + field, message);
    }

    private boolean missing(String field, boolean required) {
        Object v = obj.get(field);
        if (v == null) {
            if (required) error(field, "Campo obligatorio");
            return true;
        }
        return false;
    }

    public FieldChecker string(String field, int min, int max, boolean required) {
        if (missing(field, required)) return this;
        if (!(obj.get(field) instanceof String s)) error(field, "Debe ser texto");
        else if (s.trim().length() < min) error(field, min > 0 ? "No puede estar vacío" : "Texto demasiado corto");
        else if (s.length() > max) error(field, "Máximo " + max + " caracteres");
        return this;
    }

    public FieldChecker number(String field, double min, double max, boolean required) {
        if (missing(field, required)) return this;
        if (!(obj.get(field) instanceof Number n) || Double.isNaN(n.doubleValue())) error(field, "Debe ser un número");
        else if (n.doubleValue() < min || n.doubleValue() > max) error(field, "Debe estar entre " + fmt(min) + " y " + fmt(max));
        return this;
    }

    public FieldChecker integer(String field, long min, long max, boolean required) {
        number(field, min, max, required);
        if (obj.get(field) instanceof Number n && n.doubleValue() != Math.floor(n.doubleValue())) error(field, "Debe ser un número entero");
        return this;
    }

    public FieldChecker bool(String field, boolean required) {
        if (missing(field, required)) return this;
        if (!(obj.get(field) instanceof Boolean)) error(field, "Debe ser verdadero o falso");
        return this;
    }

    public FieldChecker date(String field, boolean required) {
        if (missing(field, required)) return this;
        if (!(obj.get(field) instanceof String s) || !isDate(s)) error(field, "Fecha no válida (aaaa-mm-dd)");
        return this;
    }

    public FieldChecker time(String field, boolean required) {
        if (missing(field, required)) return this;
        if (!(obj.get(field) instanceof String s) || !TIME.matcher(s).matches()) error(field, "Hora no válida (HH:mm)");
        return this;
    }

    public FieldChecker oneOf(String field, Set<String> allowed, boolean required) {
        if (missing(field, required)) return this;
        if (!(obj.get(field) instanceof String s) || !allowed.contains(s)) error(field, "Valor no permitido");
        return this;
    }

    public FieldChecker stringList(String field, int maxItems, int maxLen, boolean urls) {
        if (missing(field, false)) return this;
        if (!(obj.get(field) instanceof List<?> list)) {
            error(field, "Debe ser una lista");
            return this;
        }
        if (list.size() > maxItems) error(field, "Máximo " + maxItems + " elementos");
        for (int i = 0; i < list.size(); i++) {
            Object v = list.get(i);
            if (!(v instanceof String s) || s.length() > maxLen) error(field + "." + i, "Texto no válido");
            else if (urls && !URL.matcher(s).matches()) error(field + "." + i, "Enlace no válido");
            else if (!urls && field.equals("times") && !TIME.matcher(s).matches()) error(field + "." + i, "Hora no válida (HH:mm)");
        }
        return this;
    }

    /** Validates a nested object with the given checks (skipped when absent and optional). */
    public FieldChecker object(String field, boolean required, java.util.function.Consumer<FieldChecker> checks) {
        if (missing(field, required)) return this;
        if (!(obj.get(field) instanceof Map<?, ?> m)) {
            error(field, "Debe ser un objeto");
            return this;
        }
        checks.accept(new FieldChecker(cast(m), prefix + field + ".", errors));
        return this;
    }

    /** Validates every element of a list of objects. */
    public FieldChecker objectList(String field, int maxItems, boolean required, java.util.function.Consumer<FieldChecker> checks) {
        if (missing(field, required)) return this;
        if (!(obj.get(field) instanceof List<?> list)) {
            error(field, "Debe ser una lista");
            return this;
        }
        if (list.size() > maxItems) error(field, "Máximo " + maxItems + " elementos");
        for (int i = 0; i < list.size(); i++) {
            if (!(list.get(i) instanceof Map<?, ?> m)) error(field + "." + i, "Debe ser un objeto");
            else checks.accept(new FieldChecker(cast(m), prefix + field + "." + i + ".", errors));
        }
        return this;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> cast(Map<?, ?> m) {
        return (Map<String, Object>) m;
    }

    private static boolean isDate(String s) {
        try {
            LocalDate.parse(s);
            return true;
        } catch (DateTimeParseException e) {
            return false;
        }
    }

    private static String fmt(double d) {
        return d == Math.floor(d) ? String.valueOf((long) d) : String.valueOf(d);
    }
}
