//#region src/js/utils/mime-type-match.js
function e(e, t) {
	if (!e || !t) return !1;
	if (e === "*/*" || e === t) return !0;
	let [n, r] = e.split("/"), [i, a] = t.split("/");
	return n === i && (r === "*" || r === a);
}
//#endregion
//#region src/js/utils/detect-topo.js
var t = [
	"points",
	"edges",
	"rings",
	"faces",
	"shells",
	"solids"
];
function n(e) {
	return Array.isArray(e?.features) || e?.type === "Feature";
}
function r(e) {
	return Array.isArray(e?.features) ? e.features : [e];
}
function i(e) {
	return !e || typeof e != "object" || Array.isArray(e) ? !1 : t.some((t) => Array.isArray(e[t]) && e[t].some(n));
}
function a(e) {
	let t = e?.coordinates;
	if (!Array.isArray(t)) return null;
	let [n, r, i] = t;
	return !Number.isFinite(n) || !Number.isFinite(r) ? null : [
		n,
		r,
		Number.isFinite(i) ? i : null
	];
}
function o(e) {
	return Array.isArray(e?.points) ? e.points.some((e) => r(e).some((e) => a(e?.place)?.[2] != null)) : !1;
}
//#endregion
//#region src/js/utils/curie.js
function s(e, t = {}) {
	if (typeof e != "string") return e;
	let n = e.indexOf(":");
	if (n === -1) return e;
	let r = t[e.slice(0, n)];
	return typeof r == "string" ? r + e.slice(n + 1) : e;
}
function c(e, t, n = {}) {
	if (e == null) return !1;
	let r = (Array.isArray(e) ? e : [e]).map((e) => s(e, n));
	return t.some((e) => r.includes(s(e, n)));
}
//#endregion
//#region src/js/utils/rules.js
function l(e) {
	return Array.isArray(e?.features) ? e.features : [e];
}
function u(e, t) {
	let n = e?.[t];
	return Array.isArray(n) ? n.flatMap(l) : [];
}
function d(e, t) {
	return t.split(".").reduce((e, t) => e?.[t], e);
}
function f(e) {
	if (e != null && e !== "") return typeof e == "object" ? typeof e.label == "string" ? e.label : void 0 : String(e);
}
function p(e, t = {}) {
	let n = t.properties || [];
	for (let t of n) {
		let n = f(d(e, t));
		if (n !== void 0) return n;
	}
	return f(d(e, t.fallback || "id")) ?? String(e.id);
}
function m(e, t, n) {
	return !t.match || c(d(e, t.match.property), t.match.values || [], n);
}
function h(e, t, n = e?.["@context"] || {}) {
	let r = t?.rules || [], i = [...new Set(r.map((e) => e.source))], a = [];
	return i.forEach((i) => {
		let o = r.filter((e) => e.source === i);
		u(e, i).forEach((e) => {
			let r = o.find((t) => m(e, t, n));
			r && a.push({
				feature: e,
				source: i,
				kind: r.kind,
				group: r.group || r.kind,
				kindLabel: r.kindLabel,
				geometry: r.geometry,
				label: p(e, r.label),
				style: {
					...t?.defaults?.style,
					...r.style
				},
				initiallyVisible: r.initiallyVisible ?? !0,
				elevation: r.elevation || t?.defaults?.elevation || "preserve"
			});
		});
	}), a;
}
//#endregion
//#region src/js/utils/topology.js
var g = "-", _ = "Face", v = "Shell", y = "SubtendedAngle", b = 16;
function x(e = []) {
	return (Array.isArray(e) ? e : []).flatMap(r);
}
function S(e = []) {
	return (Array.isArray(e) ? e : []).filter((e) => e?.featureType !== y);
}
function C(e, t = (e) => e) {
	let n = /* @__PURE__ */ new Map();
	return x(e).forEach((e) => {
		if (e?.id == null) return;
		let r = t(e);
		r != null && n.set(e.id, r);
	}), n;
}
function w(e) {
	return {
		pointMap: C(e?.points, (e) => a(e.place)),
		edgeMap: C(S(e?.edges), (e) => {
			let t = e.topology?.references;
			return Array.isArray(t) && t.length === 2 ? t : null;
		}),
		ringMap: C(e?.rings),
		faceMap: C(e?.faces),
		shellMap: C(e?.shells)
	};
}
function T(e) {
	let t = e?.topology?.directed_references;
	return Array.isArray(t) ? t : [];
}
function ee(e, t) {
	let n = [];
	for (let r of T(e)) {
		let e = t.edgeMap.get(r.ref), i = e && t.pointMap.get(e[+(r.orientation === g)]);
		if (!i) return null;
		n.push(i);
	}
	return n.length >= 3 ? n : null;
}
function E(e, t) {
	let [n, ...r] = T(e).map((e) => {
		let n = ee(t.ringMap.get(e?.ref), t);
		return n && e.orientation === g ? n.reverse() : n;
	});
	return n ? {
		outer: n,
		holes: r.filter(Boolean)
	} : null;
}
function te(e, t) {
	let n = T(e);
	if (n.length && n.every((e) => t.ringMap.has(e?.ref) && !t.edgeMap.has(e.ref))) return E(e, t);
	let r = ee(e, t);
	return r ? {
		outer: r,
		holes: []
	} : null;
}
function D(e, t) {
	let n = t.faceMap.get(e);
	if (n && n.topology?.type !== v) return {
		kind: _,
		feature: n
	};
	let r = t.shellMap.get(e);
	return r ? {
		kind: v,
		feature: r
	} : null;
}
function O(e, t, n = /* @__PURE__ */ new Set([e?.id]), r = 0) {
	return r > b ? [] : T(e).flatMap((e) => {
		let i = D(e?.ref, t);
		return i ? i.kind === _ ? [i.feature] : n.has(e.ref) ? [] : O(i.feature, t, new Set(n).add(e.ref), r + 1) : [];
	});
}
function k(e, t) {
	return O(e, t).map((e) => E(e, t)).filter(Boolean);
}
function ne(e, t) {
	let n = /* @__PURE__ */ new Set(), r = (e, i) => {
		i > b || T(e).forEach((e) => {
			let a = D(e?.ref, t);
			a?.kind !== v || n.has(e.ref) || (n.add(e.ref), r(a.feature, i + 1));
		});
	};
	return e.forEach((e) => r(e, 0)), n;
}
function re(e, t) {
	let n = ne(x(e?.solids), t);
	return x(e?.shells).filter((e) => !n.has(e.id));
}
function ie(e, t) {
	let n = /* @__PURE__ */ new Map(), r = null, i = (e, t) => {
		n.has(e) || n.set(e, /* @__PURE__ */ new Set()), n.get(e).add(t);
	};
	if (e.forEach((e) => {
		let n = t.edgeMap.get(e);
		n && t.pointMap.has(n[0]) && t.pointMap.has(n[1]) && (r ??= n[0], i(n[0], n[1]), i(n[1], n[0]));
	}), r == null) return [];
	let a = [r], o = new Set(a), s = null, c = r;
	for (let e = 0; e < n.size + 1; e++) {
		let e = [...n.get(c) ?? []], t = e.find((e) => e !== s) ?? e[0];
		if (t == null || t === r && a.length > 2 || o.has(t)) break;
		a.push(t), o.add(t), s = c, c = t;
	}
	return a.map((e) => t.pointMap.get(e));
}
function ae(e) {
	let t = e?.topology?.references;
	return !Array.isArray(t) || !t.length ? [] : Array.isArray(t[0]) ? t : [t];
}
function oe(e, t) {
	let n = ae(e).map((e) => ie(e, t)).filter((e) => e.length >= 3);
	if (!n.length) return null;
	let [r, ...i] = n;
	return {
		outer: r,
		holes: i
	};
}
function se(e, t) {
	return k(e, t).flatMap((e) => [e.outer, ...e.holes].flat()).map(([, , e]) => e).filter((e) => e != null);
}
//#endregion
//#region src/js/utils/levels.js
var A = Object.freeze({
	levelProperty: "properties.floors",
	exclude: Object.freeze([Object.freeze({
		source: "occupationFeatures",
		property: "properties.geometryRef"
	})]),
	sectionZ: Object.freeze({})
});
function ce(e) {
	return {
		...A,
		...e
	};
}
function le(e, t = A.exclude) {
	let n = /* @__PURE__ */ new Set();
	return (Array.isArray(t) ? t : []).forEach((t) => {
		typeof t?.source == "string" && typeof t?.property == "string" && x(e?.[t.source]).forEach((e) => {
			[d(e, t.property)].flat().forEach((e) => {
				typeof e == "string" && e && n.add(e);
			});
		});
	}), n;
}
function ue(e, t) {
	let n = le(e, ce(t).exclude);
	return x(e?.solids).filter((e) => e?.id == null || !n.has(e.id));
}
function de(e, t = A.levelProperty) {
	let n = d(e, t);
	return [...new Set([n].flat().filter(Number.isFinite))];
}
function fe(e) {
	if (!e.length) return null;
	let t = Infinity, n = -Infinity;
	return e.forEach((e) => {
		e < t && (t = e), e > n && (n = e);
	}), (t + n) / 2;
}
function pe(e, t, n = w(e)) {
	let r = ce(t), i = ue(e, r), a = /* @__PURE__ */ new Map();
	i.forEach((e) => {
		let t = de(e, r.levelProperty);
		t.forEach((r) => {
			a.has(r) || a.set(r, {
				solids: [],
				exclusiveZ: []
			});
			let i = a.get(r);
			i.solids.push(e), t.length === 1 && i.exclusiveZ.push(...se(e, n));
		});
	});
	let o = r.sectionZ && typeof r.sectionZ == "object" ? r.sectionZ : {};
	return [...a.entries()].sort(([e], [t]) => e - t).map(([e, t]) => {
		let n = o[String(e)];
		return {
			level: e,
			z: Number.isFinite(n) ? n : fe(t.exclusiveZ),
			solids: t.solids
		};
	}).filter((e) => e.z != null);
}
//#endregion
//#region src/js/utils/config.js
var j = Object.freeze({
	rules: [],
	defaults: {},
	kindOrder: []
});
function M(e) {
	return {
		rules: Array.isArray(e?.rules) ? e.rules : [],
		defaults: e?.defaults && typeof e.defaults == "object" && !Array.isArray(e.defaults) ? e.defaults : {},
		kindOrder: Array.isArray(e?.kindOrder) ? e.kindOrder : []
	};
}
function me(e) {
	if (e == null) return { ...j };
	let t = e;
	if (typeof e == "string") try {
		t = JSON.parse(e);
	} catch {
		return { ...j };
	}
	return typeof t != "object" || Array.isArray(t) ? { ...j } : M(t);
}
function he(e, t) {
	let n = M(e), r = M(t);
	return {
		rules: r.rules.length ? r.rules : n.rules,
		kindOrder: r.kindOrder.length ? r.kindOrder : n.kindOrder,
		defaults: {
			...n.defaults,
			...r.defaults,
			style: {
				...n.defaults.style,
				...r.defaults.style
			}
		}
	};
}
//#endregion
//#region src/js/utils/xy-options.js
var ge = Object.freeze([Object.freeze({ source: "parcels" })]), N = Object.freeze({
	levelProperty: A.levelProperty,
	levelLabels: Object.freeze({}),
	sectionZ: A.sectionZ,
	showContext: !1,
	padding: 2,
	grid: !0,
	boundary: ge,
	exclude: A.exclude
}), _e = Object.keys(N), P = (e) => typeof e == "object" && !!e && !Array.isArray(e), F = (e) => typeof e == "string" && e.trim() !== "", ve = (e) => e.trim() !== "" && Number.isFinite(Number(e));
function ye(e, t) {
	return e === void 0 ? N.levelProperty : F(e) ? e : (t.push("xySection.levelProperty must be a non-empty dot-path string; using \"properties.floors\""), N.levelProperty);
}
function be(e, t, n, r, i) {
	if (t === void 0) return {};
	if (!P(t)) return i.push(`xySection.${e} must be an object keyed by level number; ignoring it`), {};
	let a = {};
	return Object.entries(t).forEach(([t, o]) => {
		ve(t) && n(o) ? a[String(Number(t))] = o : i.push(`xySection.${e}["${t}"] must be keyed by a level number with ${r}; ignoring it`);
	}), a;
}
function xe(e, t, n, r) {
	return t === void 0 ? n : typeof t == "boolean" ? t : (r.push(`xySection.${e} must be true or false; using ${n}`), n);
}
function Se(e, t) {
	return e === void 0 ? N.padding : Number.isFinite(e) && e >= 0 ? e : (t.push(`xySection.padding must be a number of metres ≥ 0; using ${N.padding}`), N.padding);
}
function Ce(e, t) {
	return e === void 0 ? N.grid : typeof e == "boolean" || Number.isFinite(e) && e > 0 ? e : (t.push("xySection.grid must be true, false or a spacing in metres > 0; using automatic spacing"), N.grid);
}
function we(e) {
	return P(e) && F(e.property) && Array.isArray(e.values);
}
function Te(e, t, n) {
	let r = `xySection.boundary[${t}]`;
	if (!P(e)) return n.push(`${r} must be an object; ignoring it`), null;
	let i = { source: "parcels" };
	if (e.source !== void 0) {
		if (!F(e.source)) return n.push(`${r}.source must be a non-empty string; ignoring the entry`), null;
		i.source = e.source;
	}
	if (e.match !== void 0) {
		if (!we(e.match)) return n.push(`${r}.match needs a "property" dot-path and a "values" array; ignoring the entry`), null;
		i.match = {
			property: e.match.property,
			values: e.match.values
		};
	}
	if (e.follow !== void 0) {
		if (!P(e.follow) || !F(e.follow.role) || e.follow.source !== void 0 && !F(e.follow.source)) return n.push(`${r}.follow needs a "role" string (and optionally a "source"); ignoring the entry`), null;
		i.follow = {
			role: e.follow.role,
			source: e.follow.source ?? i.source
		};
	}
	return i;
}
function Ee(e, t) {
	if (e === void 0) return N.boundary;
	if (!Array.isArray(e)) return t.push("xySection.boundary must be an array; using the first parcel with an outline"), N.boundary;
	let n = e.map((e, n) => Te(e, n, t)).filter(Boolean);
	return e.length && !n.length ? (t.push("xySection.boundary has no valid entries; using the first parcel with an outline"), N.boundary) : n;
}
function De(e, t) {
	if (e === void 0) return N.exclude;
	if (!Array.isArray(e)) return t.push("xySection.exclude must be an array; using the default (occupationFeatures)"), N.exclude;
	let n = e.filter((e, n) => P(e) && F(e.source) && F(e.property) ? !0 : (t.push(`xySection.exclude[${n}] needs "source" and "property" strings; ignoring it`), !1)).map(({ source: e, property: t }) => ({
		source: e,
		property: t
	}));
	return e.length && !n.length ? (t.push("xySection.exclude has no valid entries; using the default (occupationFeatures)"), N.exclude) : n;
}
function Oe(e) {
	let t = [];
	if (e !== void 0 && !P(e)) return t.push("xySection must be an object; using the defaults"), {
		options: { ...N },
		warnings: t
	};
	let n = e ?? {};
	return Object.keys(n).filter((e) => !_e.includes(e)).forEach((e) => {
		t.push(`xySection.${e} is not a known option; ignoring it`);
	}), {
		options: {
			levelProperty: ye(n.levelProperty, t),
			levelLabels: be("levelLabels", n.levelLabels, F, "a non-empty string", t),
			sectionZ: be("sectionZ", n.sectionZ, Number.isFinite, "a height in metres", t),
			showContext: xe("showContext", n.showContext, N.showContext, t),
			padding: Se(n.padding, t),
			grid: Ce(n.grid, t),
			boundary: Ee(n.boundary, t),
			exclude: De(n.exclude, t)
		},
		warnings: t
	};
}
function ke(e, t = N) {
	return t.levelLabels?.[String(e)] ?? `Level ${e}`;
}
function Ae(e) {
	let t = Array.isArray(e?.resources) ? e.resources : [];
	return t.find((e) => e?.role === "https://github.com/ogcincubator/bblocks-xy-section-viewer/role/viewer-config" && e.ref) ?? t.find((e) => e?.role === "https://github.com/ogcincubator/bblocks-viewer-topo-feature-plugin/role/viewer-config" && e.ref) ?? null;
}
async function je(e, t) {
	try {
		let n = await t(e);
		return n.ok ? {
			json: JSON.parse(await n.text()),
			warning: null
		} : {
			json: null,
			warning: `config ${e} returned HTTP ${n.status}`
		};
	} catch (t) {
		return {
			json: null,
			warning: `config ${e} could not be loaded (${t.message})`
		};
	}
}
async function Me(e, t, n = globalThis.fetch) {
	let r = Ae(e?.bblock);
	if (!r) {
		let { options: e, warnings: n } = Oe(void 0);
		return {
			config: M(t),
			xySection: e,
			warnings: n,
			ref: null
		};
	}
	let { json: i, warning: a } = await je(r.ref, n), o = typeof i == "object" && !!i && !Array.isArray(i), s = a ? [a] : [];
	i != null && !o && s.push(`config ${r.ref} is not a JSON object; using the defaults`);
	let { options: c, warnings: l } = Oe(o ? i.xySection : void 0);
	return {
		config: o ? he(t, me(i)) : M(t),
		xySection: c,
		warnings: [...s, ...l],
		ref: r.ref
	};
}
//#endregion
//#region src/js/utils/xy-default-config.js
var I = Object.freeze({
	properties: Object.freeze([
		"properties.appellation.label",
		"properties.appellation",
		"properties.description",
		"properties.name"
	]),
	fallback: "id"
}), Ne = Object.freeze({
	solid: .45,
	surface: 1
});
function Pe() {
	return { rules: [{
		source: "solids",
		kind: "solid",
		geometry: "solid",
		label: I,
		style: { opacity: Ne.solid }
	}, {
		source: "surfaces",
		kind: "surface",
		geometry: "open-shell",
		label: I,
		style: { opacity: Ne.surface }
	}] };
}
//#endregion
//#region src/js/utils/section.js
var L = 1e-6, Fe = 1 - 1e-9;
function Ie(e) {
	let t = 0, n = 0, r = 0;
	for (let i = 0; i < e.length; i++) {
		let [a, o, s] = e[i], [c, l, u] = e[(i + 1) % e.length];
		t += (o - l) * (s + u), n += (s - u) * (a + c), r += (a - c) * (o + l);
	}
	let i = Math.hypot(t, n, r);
	return i ? [
		t / i,
		n / i,
		r / i
	] : null;
}
function Le(e, t, n) {
	if (e[2] >= n == t[2] >= n) return null;
	let [r, i] = e[2] < t[2] ? [e, t] : [t, e], a = (n - r[2]) / (i[2] - r[2]);
	return [r[0] + a * (i[0] - r[0]), r[1] + a * (i[1] - r[1])];
}
function Re(e) {
	return e.every((e) => e[2] != null);
}
function ze(e, t, n = L) {
	let r = [e?.outer, ...e?.holes ?? []].filter((e) => Array.isArray(e) && e.length >= 3);
	if (!r.length || !r.every(Re)) return [];
	let i = Ie(r[0]);
	if (!i || Math.abs(i[2]) >= Fe) return [];
	let a = [i[1], -i[0]], o = [];
	r.forEach((e) => {
		e.forEach((n, r) => {
			let i = Le(n, e[(r + 1) % e.length], t);
			i && o.push(i);
		});
	}), o.sort((e, t) => e[0] * a[0] + e[1] * a[1] - (t[0] * a[0] + t[1] * a[1]));
	let s = [];
	for (let e = 0; e + 1 < o.length; e += 2) {
		let [t, r] = [o[e], o[e + 1]];
		Math.hypot(r[0] - t[0], r[1] - t[1]) > n && s.push([t, r]);
	}
	return s;
}
var R = (e, t) => `${Math.round(e[0] / t)},${Math.round(e[1] / t)}`;
function Be(e, t, n = L) {
	let r = /* @__PURE__ */ new Set();
	return e.flatMap((e) => ze(e, t, n)).filter(([e, t]) => {
		let i = [R(e, n), R(t, n)].sort().join("|");
		return !r.has(i) && (r.add(i), !0);
	});
}
function z(e, t, n = L) {
	if (e.length < 3) return e;
	let r = (e, t, r) => {
		let i = Math.hypot(r[0] - e[0], r[1] - e[1]);
		if (!i) return !0;
		let a = (r[0] - e[0]) * (t[1] - e[1]) - (r[1] - e[1]) * (t[0] - e[0]);
		return Math.abs(a) / i <= n;
	}, i = e, a = !0;
	for (; a && i.length >= 3;) {
		a = !1;
		let e = [], n = i.length;
		for (let o = 0; o < n; o++) {
			let s = !t && (o === 0 || o === n - 1), c = i[(o - 1 + n) % n], l = i[(o + 1) % n];
			if (!s && r(c, i[o], l)) {
				a = !0;
				continue;
			}
			e.push(i[o]);
		}
		i = e;
	}
	return i;
}
function Ve(e, t = L) {
	let n = /* @__PURE__ */ new Map(), r = e.map(([e, n]) => [R(e, t), R(n, t)]);
	r.forEach(([e, t], r) => {
		[e, t].forEach((e) => {
			n.has(e) || n.set(e, []), n.get(e).push(r);
		});
	});
	let i = Array(e.length).fill(!1), a = (t, a) => {
		let o = t;
		for (;;) {
			let t = (n.get(o) ?? []).find((e) => !i[e]);
			if (t === void 0) return o;
			i[t] = !0;
			let [s, c] = r[t], l = s === o;
			a.push(e[t][+!!l]), o = l ? c : s;
		}
	}, o = [], s = [];
	return e.forEach((e, n) => {
		if (i[n]) return;
		i[n] = !0;
		let [c, l] = r[n], u = [e[1]];
		if (a(l, u) === c) {
			u.pop(), o.push(z([e[0], ...u], !0, t));
			return;
		}
		let d = [];
		a(c, d), s.push(z([
			...d.reverse(),
			e[0],
			...u
		], !1, t));
	}), {
		loops: o.filter((e) => e.length >= 3),
		polylines: s
	};
}
function B(e) {
	let t = 0;
	for (let n = 0; n < e.length; n++) {
		let [r, i] = e[n], [a, o] = e[(n + 1) % e.length];
		t += r * o - a * i;
	}
	return t / 2;
}
//#endregion
//#region src/js/utils/boundary.js
var He = {
	Polygon: oe,
	Ring: te,
	Face: E
};
function V(e, t) {
	let n = He[e?.topology?.type];
	return n ? n(e, t) : null;
}
function Ue(e, t, n) {
	let r = e?.topology?.relationships;
	return (Array.isArray(r) ? r : []).filter((e) => typeof e?.href == "string" && c(e.role, [t], n)).map((e) => e.href);
}
function We(e, t, n, r = e?.["@context"] || {}) {
	let i = Array.isArray(t) ? t : [];
	for (let t = 0; t < i.length; t++) {
		let a = i[t], o = x(e?.[a.source]).filter((e) => !a.match || c(d(e, a.match.property), a.match.values || [], r)), s = a.follow ? o.flatMap((t) => {
			let n = new Map(x(e?.[a.follow.source]).map((e) => [e.id, e]));
			return Ue(t, a.follow.role, r).map((e) => n.get(e)).filter(Boolean);
		}) : o;
		for (let e of s) {
			let r = V(e, n);
			if (r) return {
				feature: e,
				polygon: r,
				entryIndex: t
			};
		}
	}
	return null;
}
//#endregion
//#region src/js/xy-scene.js
var H = Object.freeze([
	"#2a78d6",
	"#eb6834",
	"#1baf7a",
	"#eda100",
	"#e87ba4",
	"#008300",
	"#4a3aa7",
	"#e34948"
]), Ge = /* @__PURE__ */ new Set([
	"solid",
	"open-shell",
	"face"
]), Ke = /* @__PURE__ */ new Set(["polygon", "ring"]), qe = /^(#[0-9a-f]{3,8}|[a-z]+|(rgb|rgba|hsl|hsla)\([0-9.,%\s/+-]+\))$/i;
function U(e) {
	return typeof e == "string" && qe.test(e.trim()) ? e.trim() : null;
}
function Je(e) {
	let t = Infinity, n = -Infinity;
	return e.forEach((e) => [e.outer, ...e.holes].forEach((e) => e.forEach(([, , e]) => {
		e != null && (e < t && (t = e), e > n && (n = e));
	}))), t <= n ? {
		min: t,
		max: n
	} : null;
}
function Ye(e) {
	let t = /* @__PURE__ */ new Map();
	e.forEach((n) => {
		let r = U(n.style?.color);
		if (r) {
			n.color = r;
			return;
		}
		let i = new Set(e.filter((e) => t.has(e.key) && e.levels.some((e) => n.levels.includes(e))).map((e) => t.get(e.key))), a = 0;
		for (; i.has(a) && a < H.length;) a++;
		a === H.length && (a = t.size % H.length), t.set(n.key, a), n.color = H[a];
	});
}
function Xe(e) {
	let t = B(e);
	if (Math.abs(t) < 1e-12) {
		let t = e.length;
		return [e.reduce((e, t) => e + t[0], 0) / t, e.reduce((e, t) => e + t[1], 0) / t];
	}
	let n = 0, r = 0;
	return e.forEach(([t, i], a) => {
		let [o, s] = e[(a + 1) % e.length], c = t * s - o * i;
		n += (t + o) * c, r += (i + s) * c;
	}), [n / (6 * t), r / (6 * t)];
}
function Ze(e) {
	return e.length ? Xe(e.reduce((e, t) => Math.abs(B(t)) > Math.abs(B(e)) ? t : e)) : null;
}
function Qe(e, { config: t, xySection: n }) {
	let r = w(e), i = pe(e, {
		levelProperty: n.levelProperty,
		exclude: n.exclude,
		sectionZ: n.sectionZ
	}, r).map(({ level: e, z: t }) => ({
		level: e,
		z: t,
		label: ke(e, n)
	})), a = le(e, n.exclude), o = (t?.rules ?? []).map((e) => e?.label ? e : {
		...e,
		label: I
	}), s = h({
		...e,
		surfaces: re(e, r)
	}, {
		...t,
		rules: o
	}), c = [];
	s.forEach((e) => {
		let { feature: t, geometry: n } = e;
		if (t?.id != null && a.has(t.id)) return;
		let o, s = [], l = null;
		if (Ge.has(n)) {
			if (o = "section", s = n === "face" ? [E(t, r)].filter(Boolean) : k(t, r), !s.length) return;
		} else if (Ke.has(n)) {
			if (o = "outline", l = V(t, r), !l) return;
		} else return;
		let u = o === "section" ? Je(s) : null, d = i.filter((e) => o === "outline" || u && e.z >= u.min && e.z <= u.max).map((e) => e.level);
		d.length && c.push({
			key: `r${c.length}`,
			id: t?.id ?? null,
			source: e.source,
			kind: e.kind,
			group: e.group,
			kindLabel: e.kindLabel,
			label: e.label,
			style: e.style ?? {},
			visible: e.initiallyVisible !== !1,
			mode: o,
			polygons: s,
			outline: l,
			levels: d
		});
	}), Ye(c);
	let l = We(e, n.boundary, r), u = [...c.flatMap((e) => (e.mode === "section" ? e.polygons : [e.outline]).flatMap((e) => [e.outer, ...e.holes].flat())), ...l ? [l.polygon.outer, ...l.polygon.holes].flat() : []], d = u.map((e) => e[0]), f = u.map((e) => e[1]), m = u.length ? {
		minX: Math.min(...d),
		minY: Math.min(...f),
		maxX: Math.max(...d),
		maxY: Math.max(...f)
	} : {
		minX: 0,
		minY: 0,
		maxX: 1,
		maxY: 1
	}, g = [m.minX, m.maxY], _ = ([e, t]) => [e - g[0], g[1] - t], v = ([e, t]) => [e + g[0], g[1] - t], y = {
		minX: 0,
		minY: 0,
		maxX: m.maxX - m.minX,
		maxY: m.maxY - m.minY
	}, b = (e) => [e.outer, ...e.holes].map((e) => e.map(_));
	c.filter((e) => e.mode === "outline").forEach((e) => {
		e.outlineLoops = b(e.outline);
	});
	let x = l && {
		id: l.feature.id ?? null,
		label: p(l.feature, I),
		loops: b(l.polygon)
	}, S = /* @__PURE__ */ new Map();
	function C(e) {
		if (S.has(e)) return S.get(e);
		let t = i.find((t) => t.level === e), n = /* @__PURE__ */ new Map();
		return t && c.forEach((r) => {
			if (r.mode === "outline") {
				n.set(r.key, {
					loops: r.outlineLoops,
					polylines: []
				});
				return;
			}
			if (!r.levels.includes(e)) return;
			let { loops: i, polylines: a } = Ve(Be(r.polygons, t.z));
			(i.length || a.length) && n.set(r.key, {
				loops: i.map((e) => e.map(_)),
				polylines: a.map((e) => e.map(_))
			});
		}), S.set(e, n), n;
	}
	return {
		meta: {
			name: e?.name ?? e?.id ?? "",
			horizontalCRS: typeof e?.horizontalCRS == "string" ? e.horizontalCRS : null,
			verticalCRS: typeof e?.verticalCRS == "string" ? e.verticalCRS : null,
			bearingRotation: Number.isFinite(e?.bearingRotation) ? e.bearingRotation : null
		},
		levels: i,
		records: c,
		boundary: x,
		bounds: y,
		origin: g,
		toLocal: _,
		toWorld: v,
		shapesAt: C,
		contextLevels: (e) => i.filter((t) => t.level < e)
	};
}
//#endregion
//#region src/js/ui/icons.js
var W = (e, t = "fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"") => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" ${t}>${e}</svg>`, G = {
	zoomIn: W("<circle cx=\"11\" cy=\"11\" r=\"6\"/><path d=\"m20 20-4.35-4.35\"/><path d=\"M11 8v6M8 11h6\"/>"),
	zoomOut: W("<circle cx=\"11\" cy=\"11\" r=\"6\"/><path d=\"m20 20-4.35-4.35\"/><path d=\"M8 11h6\"/>"),
	fit: W("<path d=\"M4 9V4h5\"/><path d=\"M20 9V4h-5\"/><path d=\"M4 15v5h5\"/><path d=\"M20 15v5h-5\"/><rect x=\"8\" y=\"8\" width=\"8\" height=\"8\" rx=\"1\"/>"),
	context: W("<rect x=\"3\" y=\"9\" width=\"12\" height=\"12\" rx=\"1\" stroke-dasharray=\"2.5 2.5\"/><rect x=\"9\" y=\"3\" width=\"12\" height=\"12\" rx=\"1\"/>"),
	labels: W("<path d=\"M3 7V5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2\"/><path d=\"M12 4v16\"/><path d=\"M9 20h6\"/>"),
	layers: W("<path d=\"M12 3 2 8l10 5 10-5Z\"/><path d=\"m2 13 10 5 10-5\"/>"),
	download: W("<path d=\"M12 4v11\"/><path d=\"m7 10 5 5 5-5\"/><path d=\"M5 20h14\"/>"),
	fullscreen: W("<path d=\"M9 3H5a2 2 0 0 0-2 2v4\"/><path d=\"M15 3h4a2 2 0 0 1 2 2v4\"/><path d=\"M9 21H5a2 2 0 0 1-2-2v-4\"/><path d=\"M15 21h4a2 2 0 0 0 2-2v-4\"/>"),
	fullscreenExit: W("<path d=\"M4 9V5a2 2 0 0 1 2-2h4\"/><path d=\"M20 9V5a2 2 0 0 0-2-2h-4\"/><path d=\"M4 15v4a2 2 0 0 0 2 2h4\"/><path d=\"M20 15v4a2 2 0 0 1-2 2h-4\"/>"),
	north: W("<path d=\"M12 3 7 20l5-4 5 4Z\" fill=\"currentColor\"/>", "fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linejoin=\"round\"")
}, $e = [
	1,
	2,
	5,
	10
];
function et(e, t = 8) {
	if (!(e > 0) || !(t > 0)) return 1;
	let n = e / t, r = 10 ** Math.floor(Math.log10(n));
	return $e.find((e) => e * r >= n) * r;
}
function K(e, t = 0) {
	let n = Math.max(e.maxX - e.minX, 1e-6) + 2 * t, r = Math.max(e.maxY - e.minY, 1e-6) + 2 * t;
	return {
		x: e.minX - t,
		y: e.minY - t,
		w: n,
		h: r
	};
}
function q(e, t, n) {
	let r = Math.max(e.w / t, e.h / n);
	return {
		scale: r,
		offsetX: (t - e.w / r) / 2,
		offsetY: (n - e.h / r) / 2
	};
}
function tt(e, t, n, r, i) {
	let { scale: a, offsetX: o, offsetY: s } = q(e, r, i);
	return [e.x + (t - o) * a, e.y + (n - s) * a];
}
function nt(e, t, n = [e.x + e.w / 2, e.y + e.h / 2], { minW: r = 0, maxW: i = Infinity } = {}) {
	let a = Math.min(Math.max(e.w / t, r), i), o = e.w / a, s = e.h / o, [c, l] = n;
	return {
		x: c - (c - e.x) / o,
		y: l - (l - e.y) / o,
		w: a,
		h: s
	};
}
function rt(e, t, n, r, i) {
	let { scale: a } = q(e, r, i);
	return {
		...e,
		x: e.x - t * a,
		y: e.y - n * a
	};
}
var it = ({ x: e, y: t, w: n, h: r }) => [
	e,
	t,
	n,
	r
].map((e) => +e.toFixed(4)).join(" "), J = Object.freeze({
	surface: "#fcfcfb",
	primary: "#0b0b0b",
	secondary: "#52514e",
	muted: "#898781",
	grid: "#e1e0d9"
}), at = .45, ot = .4, st = "6 4", ct = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	"\"": "&quot;",
	"'": "&#39;"
}, Y = (e) => String(e ?? "").replace(/[&<>"']/g, (e) => ct[e]), X = (e) => +e.toFixed(3), Z = (e, t = []) => [...e.map((e) => `M${e.map(([e, t]) => `${X(e)} ${X(t)}`).join("L")}Z`), ...t.map((e) => `M${e.map(([e, t]) => `${X(e)} ${X(t)}`).join("L")}`)].join(""), lt = (e) => Number.isFinite(e) ? Math.min(Math.max(e, 0), 1) : null;
function ut(e, t) {
	return t === !1 ? null : Number.isFinite(t) && t > 0 ? t : et(Math.max(e.bounds.maxX, e.bounds.maxY));
}
var dt = 10, ft = 200;
function pt(e, t) {
	let { maxX: n, maxY: r } = e.bounds, i = Math.min(Math.max(n, r, t) * dt, t * ft), [a, o] = e.origin, s = [], c = Math.ceil((a - i) / t) * t;
	for (let e = c; e <= a + n + i; e += t) {
		let t = X(e - a);
		s.push(`M${t} ${X(-i)}V${X(r + i)}`);
	}
	let l = Math.floor((o + i) / t) * t;
	for (let e = l; e >= o - r - i; e -= t) {
		let t = X(o - e);
		s.push(`M${X(-i)} ${t}H${X(n + i)}`);
	}
	return `<path class="xys-grid" d="${s.join("")}" fill="none" stroke="${J.grid}" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
}
function mt(e, t) {
	let n = e.style ?? {}, r = U(n.lineColor) ?? e.color, i = n.lineStyle === "dashed" ? ` stroke-dasharray="${st}"` : "", a = lt(n.opacity) ?? (e.mode === "outline" ? 0 : at), o = a > 0 && t.loops.length ? `fill="${e.color}" fill-opacity="${a}"` : "fill=\"none\"", s = [];
	return t.loops.length && s.push(`<path d="${Z(t.loops)}" fill-rule="evenodd" ${o} stroke="${r}" stroke-width="1.5"${i} vector-effect="non-scaling-stroke"/>`), t.polylines.length && s.push(`<path d="${Z([], t.polylines)}" fill="none" stroke="${r}" stroke-width="1.5"${i} vector-effect="non-scaling-stroke"/>`), `<g class="xys-record" data-key="${e.key}"><title>${Y(e.label)}</title>${s.join("")}</g>`;
}
function ht(e, t, n = {}) {
	let { isVisible: r = (t) => e.records.find((e) => e.key === t)?.visible ?? !0, showContext: i = !1, showLabels: a = !0, showBoundary: o = !0, grid: s = !0, padding: c = 2, standalone: l = !1 } = n, u = e.levels.find((e) => e.level === t), d = n.viewBox ?? K(e.bounds, c), f = u ? `${u.label}: section at Z = ${u.z.toFixed(3)} m` : `Level ${t}`, p = new Map(e.records.map((e) => [e.key, e])), m = u ? e.shapesAt(t) : /* @__PURE__ */ new Map(), h = (e) => [...m.entries()].filter(([t]) => p.get(t)?.mode === e && r(t)).map(([e, t]) => [p.get(e), t]), g = [], _ = ut(e, s);
	if (_ && g.push(pt(e, _)), i && u) {
		let n = e.contextLevels(t).flatMap((t) => [...e.shapesAt(t.level).entries()].filter(([e]) => p.get(e)?.mode === "section" && r(e)).map(([e, n]) => `<path data-level="${t.level}" d="${Z(n.loops, n.polylines)}" fill="none" stroke="${p.get(e).color}" stroke-width="1" stroke-opacity="${ot}" vector-effect="non-scaling-stroke"><title>${Y(`${p.get(e).label} (${t.label})`)}</title></path>`));
		g.push(`<g class="xys-context">${n.join("")}</g>`);
	}
	g.push(`<g class="xys-outlines">${h("outline").map(([e, t]) => mt(e, t)).join("")}</g>`);
	let v = h("section");
	if (g.push(`<g class="xys-sections">${v.map(([e, t]) => mt(e, t)).join("")}</g>`), o && e.boundary && g.push(`<g class="xys-boundary"><title>${Y(`Boundary: ${e.boundary.label}`)}</title><path d="${Z(e.boundary.loops)}" fill="none" fill-rule="evenodd" stroke="${J.secondary}" stroke-width="2" stroke-dasharray="8 4" vector-effect="non-scaling-stroke"/></g>`), a) {
		let t = X(Math.max(Math.max(e.bounds.maxX, e.bounds.maxY) / 70, .2)), n = v.map(([e, t]) => {
			let n = Ze(t.loops);
			return n ? `<text x="${X(n[0])}" y="${X(n[1])}" data-key="${e.key}">${Y(e.label)}</text>` : "";
		});
		g.push(`<g class="xys-labels" font-family="system-ui, sans-serif" font-size="${t}" letter-spacing="0" word-spacing="0" text-anchor="middle" dominant-baseline="central" fill="${J.primary}" stroke="${J.surface}" stroke-width="${X(t / 5)}" paint-order="stroke" pointer-events="none">${n.join("")}</g>`);
	}
	let y = l ? `<svg xmlns="http://www.w3.org/2000/svg" width="${X(Math.min(1600, d.w * 20))}" height="${X(Math.min(1600, d.w * 20) * d.h / d.w)}"` : "<svg xmlns=\"http://www.w3.org/2000/svg\" class=\"xys-svg\" width=\"100%\" height=\"100%\"", b = l ? gt(e, u) : "", x = l ? `<rect x="${X(d.x)}" y="${X(d.y)}" width="${X(d.w)}" height="${X(d.h)}" fill="${J.surface}"/>` : "";
	return `${y} viewBox="${it(d)}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${Y(f)}"><title>${Y(f)}</title>${b}${x}${g.join("")}</svg>`;
}
function gt(e, t) {
	let { name: n, horizontalCRS: r, verticalCRS: i, bearingRotation: a } = e.meta, [o, s] = e.origin;
	return `<desc>${Y([
		n && `Document: ${n}`,
		t && `${t.label}: horizontal section at Z = ${t.z.toFixed(3)} m${i ? ` (${i})` : ""}`,
		r && `Horizontal CRS: ${r}`,
		`Drawing units are metres; drawing point (x, y) is easting ${X(o)} + x, northing ${X(s)} − y. Grid north is up.`,
		a != null && `Bearing rotation ${a}° (not applied).`
	].filter(Boolean).join("\n"))}</desc>`;
}
var _t = 1.5, vt = 1.0015, yt = 4, bt = .5, Q = {
	solid: "Solids",
	surface: "Surfaces",
	parcel: "Parcels",
	face: "Faces",
	ring: "Rings"
};
function $(e) {
	let t = String(e).replace(/[-_]+/g, " ").trim();
	return t ? t.charAt(0).toUpperCase() + t.slice(1) : String(e);
}
function xt(e) {
	return String(e).normalize("NFKD").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "section";
}
var St = (e) => e.toLocaleString("en-AU", {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2
}), Ct = 0, wt = class {
	constructor(e, { model: t, xySection: n, actions: r }) {
		this.root = e, this.doc = e.ownerDocument, this.model = t, this.options = n, this.actions = r, this.uid = `xys${++Ct}`, this.active = 0, this.visible = new Map(t.records.map((e) => [e.key, e.visible])), this.showContext = !!n.showContext, this.showLabels = !0, this.showBoundary = !0, this.fitted = K(t.bounds, n.padding), this.viewBox = { ...this.fitted }, this.rendered = /* @__PURE__ */ new Set(), this.layersOpen = !1, this.drag = null, this.listeners = [], this._build(), this.activate(0), this.applyViewMode();
	}
	_el(e, t, n) {
		let r = this.doc.createElement(e);
		return t && (r.className = t), n !== void 0 && (r.textContent = n), r;
	}
	_on(e, t, n, r) {
		e.addEventListener(t, n, r), this.listeners.push([
			e,
			t,
			n,
			r
		]);
	}
	_button(e, t, n, r, i) {
		let a = this._el("button", "xys-button");
		return a.type = "button", a.dataset.key = e, a.setAttribute("aria-label", t), a.title = t, a.innerHTML = n, i !== void 0 && a.setAttribute("aria-pressed", String(i)), this._on(a, "click", r), this.buttons[e] = a, a;
	}
	_build() {
		let { model: e } = this;
		this.buttons = {}, this.tablist = this._el("div", "xys-tabs"), this.tablist.setAttribute("role", "tablist"), this.tablist.setAttribute("aria-label", "Floor levels"), this._on(this.tablist, "keydown", (e) => this._onTabKey(e)), this.body = this._el("div", "xys-body"), this.stage = this._el("div", "xys-stage"), this.tabs = [], this.panels = [], e.levels.forEach((e, t) => {
			let n = this._el("button", "xys-tab", e.label);
			n.type = "button", n.id = `${this.uid}-tab-${t}`, n.setAttribute("role", "tab"), n.setAttribute("aria-controls", `${this.uid}-panel-${t}`), n.title = `${e.label}: section at Z = ${e.z.toFixed(3)} m`, this._on(n, "click", () => this.activate(t)), this.tablist.appendChild(n), this.tabs.push(n);
			let r = this._el("div", "xys-panel");
			r.id = `${this.uid}-panel-${t}`, r.setAttribute("role", "tabpanel"), r.setAttribute("aria-labelledby", n.id), r.hidden = !0, this.stage.appendChild(r), this.panels.push(r);
		});
		let t = this._el("div", "xys-north");
		t.innerHTML = `${G.north}<span>N</span>`, t.title = "Grid north", this.stage.appendChild(t);
		let n = this._el("div", "xys-toolbar");
		n.append(this._button("zoomIn", "Zoom in", G.zoomIn, () => this.zoom(_t)), this._button("zoomOut", "Zoom out", G.zoomOut, () => this.zoom(1 / _t)), this._button("fit", "Fit drawing", G.fit, () => this.fit()), this._button("context", "Show lower floors", G.context, () => this.setShowContext(!this.showContext), this.showContext), this._button("labels", "Show labels", G.labels, () => this.setShowLabels(!this.showLabels), this.showLabels), this._button("layers", "Layers", G.layers, () => this.setLayersOpen(!this.layersOpen), !1), this._button("download", "Download this floor as SVG", G.download, () => this.download()), this._button("fullscreen", "Fullscreen", G.fullscreen, () => this.actions.toggleFullscreen?.(), !1)), this.layers = this._el("div", "xys-layers"), this.layers.id = `${this.uid}-layers`, this.layers.setAttribute("aria-label", "Layers"), this.buttons.layers.setAttribute("aria-controls", this.layers.id), this._buildLayers(), this.body.append(this.stage, n, this.layers), this.caption = this._el("div", "xys-caption"), this.captionText = this._el("span", "xys-caption-text"), this.readout = this._el("span", "xys-readout"), this.readout.setAttribute("aria-live", "off"), this.caption.append(this.captionText, this.readout), this.root.append(this.tablist, this.body, this.caption), this._on(this.stage, "wheel", (e) => this._onWheel(e), { passive: !1 }), this._on(this.stage, "pointerdown", (e) => this._onPointerDown(e)), this._on(this.stage, "pointermove", (e) => this._onPointerMove(e)), this._on(this.stage, "pointerup", (e) => this._onPointerUp(e)), this._on(this.stage, "pointercancel", (e) => this._onPointerUp(e)), this._on(this.stage, "pointerleave", () => {
			this.readout.textContent = "";
		}), this._on(this.stage, "dblclick", () => this.fit());
	}
	_checkbox(e, t, n) {
		let r = this._el("input");
		return r.type = "checkbox", r.checked = e, n && r.setAttribute("aria-label", n), this._on(r, "change", () => t(r.checked)), r;
	}
	_row(e, t, n, r) {
		let i = this._el("label", `xys-row ${e}`.trim());
		return i.append(t, n, this._el("span", "xys-row-label", r)), i;
	}
	_buildLayers() {
		let { model: e } = this;
		if (this.layerInputs = {
			groups: [],
			kinds: [],
			items: /* @__PURE__ */ new Map()
		}, this.layerRows = /* @__PURE__ */ new Map(), e.boundary) {
			this.layers.appendChild(this._el("h3", null, "Boundary"));
			let t = this._el("span", "xys-swatch xys-swatch-boundary"), n = this._checkbox(this.showBoundary, (e) => this.setShowBoundary(e));
			this.boundaryInput = n, this.layers.appendChild(this._row("", n, t, e.boundary.label));
		}
		[...new Set(e.records.map((e) => e.group))].forEach((t) => {
			let n = e.records.filter((e) => e.group === t), r = this._checkbox(!1, (e) => this.setVisible(n, e), `All ${Q[t] ?? $(t)}`), i = this._el("h3"), a = this._el("label", "xys-row");
			a.append(r, this._el("span", null, Q[t] ?? $(t))), i.appendChild(a), this.layers.appendChild(i), this.layerInputs.groups.push({
				input: r,
				records: n
			});
			let o = [...new Set(n.map((e) => e.kind))];
			o.forEach((e) => {
				let t = n.filter((t) => t.kind === e);
				if (o.length > 1) {
					let n = t[0].kindLabel ?? $(e), r = this._checkbox(!1, (e) => this.setVisible(t, e), `All ${n}`), i = this._el("h4"), a = this._el("label", "xys-row");
					a.append(r, this._el("span", null, n)), i.appendChild(a), this.layers.appendChild(i), this.layerInputs.kinds.push({
						input: r,
						records: t
					});
				}
				t.forEach((e) => {
					let t = this._checkbox(this.visible.get(e.key), (t) => this.setVisible([e], t)), n = this._el("span", "xys-swatch"), r = /^#[0-9a-f]{6}$/i.test(e.color) ? `${e.color}40` : "transparent";
					n.style.cssText = `color: ${e.color}; background: ${r}`;
					let i = this._row("xys-item", t, n, e.label);
					i.dataset.key = e.key, this.layers.appendChild(i), this.layerInputs.items.set(e.key, t), this.layerRows.set(e.key, i);
				});
			});
		}), this._syncLayers();
	}
	_syncLayers() {
		this.layerInputs.items.forEach((e, t) => {
			e.checked = this.visible.get(t);
		}), [...this.layerInputs.groups, ...this.layerInputs.kinds].forEach(({ input: e, records: t }) => {
			let n = t.filter((e) => this.visible.get(e.key)).length;
			e.checked = n === t.length, e.indeterminate = n > 0 && n < t.length;
		}), this.boundaryInput && (this.boundaryInput.checked = this.showBoundary);
		let e = this.model.levels[this.active]?.level, t = e === void 0 ? /* @__PURE__ */ new Map() : this.model.shapesAt(e);
		this.layerRows.forEach((e, n) => {
			let r = !t.has(n);
			e.classList?.toggle("xys-absent", r), e.title = r ? "Not on this floor" : "";
		});
	}
	activate(e, { focus: t = !1 } = {}) {
		e < 0 || e >= this.tabs.length || (this.active = e, this.tabs.forEach((t, n) => {
			let r = n === e;
			t.setAttribute("aria-selected", String(r)), t.tabIndex = r ? 0 : -1, this.panels[n].hidden = !r;
		}), t && this.tabs[e].focus(), this._renderActive(), this._applyViewBox(), this._syncLayers(), this._updateCaption());
	}
	_onTabKey(e) {
		let t = this.tabs.length - 1, n = {
			ArrowRight: this.active === t ? 0 : this.active + 1,
			ArrowLeft: this.active === 0 ? t : this.active - 1,
			Home: 0,
			End: t
		}[e.key];
		n !== void 0 && (e.preventDefault(), this.activate(n, { focus: !0 }));
	}
	_svgOptions() {
		return {
			isVisible: (e) => this.visible.get(e),
			showContext: this.showContext,
			showLabels: this.showLabels,
			showBoundary: this.showBoundary,
			grid: this.options.grid,
			padding: this.options.padding
		};
	}
	_renderActive() {
		let e = this.active;
		if (this.rendered.has(e) || !this.panels[e]) return;
		let t = this.model.levels[e].level;
		this.panels[e].innerHTML = ht(this.model, t, {
			...this._svgOptions(),
			viewBox: this.viewBox
		}), this.rendered.add(e), this._applyViewBox();
	}
	_invalidate() {
		this.rendered.clear(), this._renderActive();
	}
	_svg(e = this.active) {
		return this.panels[e]?.firstElementChild ?? null;
	}
	_applyViewBox() {
		this._svg()?.setAttribute("viewBox", it(this.viewBox));
	}
	setVisible(e, t) {
		e.forEach((e) => this.visible.set(e.key, t)), this._invalidate(), this._syncLayers();
	}
	setShowContext(e) {
		this.showContext = e, this.buttons.context.setAttribute("aria-pressed", String(e)), this._invalidate();
	}
	setShowLabels(e) {
		this.showLabels = e, this.buttons.labels.setAttribute("aria-pressed", String(e)), this._invalidate();
	}
	setShowBoundary(e) {
		this.showBoundary = e, this._invalidate(), this._syncLayers();
	}
	setLayersOpen(e) {
		this.layersOpen = e, this.applyViewMode();
	}
	_stageSize() {
		let e = this.stage.getBoundingClientRect?.() ?? {
			left: 0,
			top: 0,
			width: 0,
			height: 0
		}, t = e.width || this.stage.clientWidth || 0, n = e.height || this.stage.clientHeight || 0;
		return {
			left: e.left ?? 0,
			top: e.top ?? 0,
			width: t,
			height: n
		};
	}
	_setViewBox(e) {
		this.viewBox = e, this._applyViewBox();
	}
	zoom(e, t) {
		this._setViewBox(nt(this.viewBox, e, t, {
			minW: bt,
			maxW: this.fitted.w * yt
		}));
	}
	fit() {
		this._setViewBox({ ...this.fitted });
	}
	_pointerView(e) {
		let { left: t, top: n, width: r, height: i } = this._stageSize();
		return !r || !i ? null : tt(this.viewBox, e.clientX - t, e.clientY - n, r, i);
	}
	_onWheel(e) {
		e.preventDefault();
		let t = this._pointerView(e) ?? void 0;
		this.zoom(vt ** -e.deltaY, t);
	}
	_onPointerDown(e) {
		(e.button === void 0 || e.button === 0) && (this.drag = {
			x: e.clientX,
			y: e.clientY,
			viewBox: this.viewBox,
			id: e.pointerId
		}, this.stage.setPointerCapture?.(e.pointerId), this.stage.classList?.add("xys-dragging"));
	}
	_onPointerMove(e) {
		let t = this._pointerView(e);
		if (t) {
			let [e, n] = this.model.toWorld(t);
			this.readout.textContent = `E ${St(e)}  N ${St(n)}`;
		}
		if (!this.drag) return;
		let { width: n, height: r } = this._stageSize();
		n && r && this._setViewBox(rt(this.drag.viewBox, e.clientX - this.drag.x, e.clientY - this.drag.y, n, r));
	}
	_onPointerUp(e) {
		this.drag &&= (this.stage.releasePointerCapture?.(e.pointerId), this.stage.classList?.remove("xys-dragging"), null);
	}
	_updateCaption() {
		let e = this.model.levels[this.active], { horizontalCRS: t, verticalCRS: n, bearingRotation: r } = this.model.meta, i = ut(this.model, this.options.grid), a = [
			e && `${e.label}: section at Z = ${e.z.toFixed(3)} m${n ? ` (${n})` : ""}`,
			`${t ? `${t}, ` : ""}easting/northing in metres`,
			i && `grid ${i} m`,
			r != null && `bearing rotation ${r}° not applied`
		].filter(Boolean);
		this.captionText.textContent = a.join(" · ");
	}
	download() {
		let e = this.model.levels[this.active];
		if (!e) return;
		let t = ht(this.model, e.level, {
			...this._svgOptions(),
			standalone: !0
		}), n = xt(`${this.model.meta.name || "section"}-${e.label}`);
		this.actions.download?.(`${n}.svg`, t);
	}
	isExpanded() {
		return (this.root.clientHeight ?? 0) >= 400;
	}
	applyViewMode() {
		let e = this.isExpanded();
		this.root.classList?.toggle("xys-expanded", e), this.layers.hidden = !e && !this.layersOpen, this.buttons.layers.setAttribute("aria-pressed", String(!e && this.layersOpen)), this.buttons.layers.setAttribute("aria-expanded", String(e || this.layersOpen));
		let t = !!this.actions.isFullscreen?.();
		this.buttons.fullscreen.setAttribute("aria-pressed", String(t)), this.buttons.fullscreen.innerHTML = t ? G.fullscreenExit : G.fullscreen;
		let n = t ? "Exit fullscreen" : "Fullscreen";
		this.buttons.fullscreen.setAttribute("aria-label", n), this.buttons.fullscreen.title = n;
	}
	destroy() {
		this.listeners.forEach(([e, t, n, r]) => e.removeEventListener(t, n, r)), this.listeners = [], this.drag = null;
	}
}, Tt = "/* XYSectionPlugin UI. Plain CSS, no host framework: the plugin runs outside the host's component\n   tree. Everything is scoped under .xys-root, the plugin's own wrapper element. The drawing has\n   its own light surface (a plan sheet), whatever the host's theme. */\n\n.xys-root {\n  --xys-surface: #fcfcfb;\n  --xys-panel: #ffffff;\n  --xys-ink: #0b0b0b;\n  --xys-ink-2: #52514e;\n  --xys-muted: #898781;\n  --xys-border: rgba(11, 11, 11, 0.12);\n  --xys-accent: #2a78d6;\n  --xys-hover: #eef3fa;\n\n  position: absolute;\n  inset: 0;\n  display: flex;\n  flex-direction: column;\n  overflow: hidden;\n  font: 12px/1.4 system-ui, sans-serif;\n  /* The host page's own text settings (e.g. Vuetify's letter-spacing) would otherwise be inherited. */\n  letter-spacing: normal;\n  word-spacing: normal;\n  text-transform: none;\n  color: var(--xys-ink);\n  background: var(--xys-surface);\n}\n\n.xys-root:fullscreen {\n  width: 100vw;\n  height: 100vh;\n}\n\n/* ─── Floor tabs ──────────────────────────────────────────────────────────────── */\n\n.xys-tabs {\n  display: flex;\n  flex: none;\n  gap: 2px;\n  padding: 4px 8px 0;\n  overflow-x: auto;\n  border-bottom: 1px solid var(--xys-border);\n  background: var(--xys-panel);\n}\n\n.xys-tab {\n  flex: none;\n  padding: 6px 12px;\n  border: none;\n  border-bottom: 2px solid transparent;\n  background: none;\n  color: var(--xys-ink-2);\n  font: inherit;\n  cursor: pointer;\n}\n\n.xys-tab:hover {\n  background: var(--xys-hover);\n}\n\n.xys-tab[aria-selected=\"true\"] {\n  border-bottom-color: var(--xys-accent);\n  color: var(--xys-ink);\n  font-weight: 600;\n}\n\n.xys-tab:focus-visible,\n.xys-button:focus-visible,\n.xys-layers input:focus-visible {\n  outline: 2px solid var(--xys-accent);\n  outline-offset: 1px;\n}\n\n/* ─── Drawing area ────────────────────────────────────────────────────────────── */\n\n.xys-body {\n  position: relative;\n  flex: 1;\n  min-height: 0;\n  display: flex;\n}\n\n.xys-stage {\n  position: relative;\n  flex: 1;\n  min-width: 0;\n  overflow: hidden;\n  cursor: grab;\n  touch-action: none;\n  user-select: none;\n}\n\n.xys-stage.xys-dragging {\n  cursor: grabbing;\n}\n\n.xys-panel {\n  position: absolute;\n  inset: 0;\n}\n\n.xys-panel[hidden] {\n  display: none;\n}\n\n.xys-svg {\n  display: block;\n}\n\n.xys-north {\n  position: absolute;\n  right: 10px;\n  top: 8px;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  color: var(--xys-ink-2);\n  font-weight: 600;\n  pointer-events: none;\n}\n\n.xys-north svg {\n  width: 16px;\n  height: 16px;\n}\n\n/* ─── Toolbar ─────────────────────────────────────────────────────────────────── */\n\n/* Wraps into a second column when the compact tab is too short for one. */\n.xys-toolbar {\n  position: absolute;\n  top: 8px;\n  left: 8px;\n  bottom: 8px;\n  z-index: 10;\n  display: flex;\n  flex-direction: column;\n  flex-wrap: wrap;\n  align-content: flex-start;\n  gap: 4px;\n  pointer-events: none;\n}\n\n.xys-toolbar > * {\n  pointer-events: auto;\n}\n\n.xys-button {\n  width: 28px;\n  height: 28px;\n  padding: 0;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  border: 1px solid var(--xys-border);\n  border-radius: 4px;\n  background: var(--xys-panel);\n  color: var(--xys-ink-2);\n  cursor: pointer;\n}\n\n.xys-button:hover {\n  background: var(--xys-hover);\n}\n\n.xys-button[aria-pressed=\"true\"] {\n  background: var(--xys-accent);\n  border-color: var(--xys-accent);\n  color: #fff;\n}\n\n.xys-button svg {\n  width: 18px;\n  height: 18px;\n}\n\n/* The layers button is only needed while the panel is a pop-over. */\n.xys-expanded .xys-button[data-key=\"layers\"] {\n  display: none;\n}\n\n/* ─── Layers panel ────────────────────────────────────────────────────────────── */\n\n.xys-layers {\n  position: absolute;\n  top: 8px;\n  left: 76px;\n  z-index: 11;\n  width: 230px;\n  max-height: calc(100% - 16px);\n  overflow-y: auto;\n  padding: 8px;\n  border: 1px solid var(--xys-border);\n  border-radius: 4px;\n  background: var(--xys-panel);\n  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);\n}\n\n.xys-layers[hidden] {\n  display: none;\n}\n\n.xys-expanded .xys-layers,\n.xys-expanded .xys-layers[hidden] {\n  position: static;\n  display: block;\n  flex: none;\n  width: 250px;\n  max-height: none;\n  border: none;\n  border-left: 1px solid var(--xys-border);\n  border-radius: 0;\n  box-shadow: none;\n}\n\n.xys-layers h3 {\n  margin: 8px 0 4px;\n  font-size: 11px;\n  font-weight: 600;\n  letter-spacing: 0.02em;\n  text-transform: uppercase;\n  color: var(--xys-muted);\n}\n\n.xys-layers h3:first-child {\n  margin-top: 0;\n}\n\n.xys-layers h4 {\n  margin: 6px 0 2px 18px;\n  font-size: 11px;\n  font-weight: 600;\n  color: var(--xys-ink-2);\n}\n\n.xys-row {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  padding: 2px 0;\n  cursor: pointer;\n}\n\n.xys-row.xys-item {\n  padding-left: 18px;\n}\n\n.xys-row input {\n  margin: 0;\n}\n\n.xys-row.xys-absent {\n  color: var(--xys-muted);\n}\n\n.xys-swatch {\n  flex: none;\n  width: 12px;\n  height: 12px;\n  border-radius: 2px;\n  border: 1.5px solid currentColor;\n}\n\n.xys-swatch-boundary {\n  border: 2px dashed var(--xys-ink-2);\n  background: none;\n}\n\n/* ─── Caption ─────────────────────────────────────────────────────────────────── */\n\n.xys-caption {\n  flex: none;\n  display: flex;\n  flex-wrap: wrap;\n  justify-content: space-between;\n  gap: 2px 12px;\n  padding: 4px 8px;\n  border-top: 1px solid var(--xys-border);\n  background: var(--xys-panel);\n  color: var(--xys-ink-2);\n}\n\n.xys-readout {\n  font-variant-numeric: tabular-nums;\n  color: var(--xys-muted);\n}\n\n/* ─── Messages ────────────────────────────────────────────────────────────────── */\n\n.xys-message {\n  padding: 16px;\n  color: var(--xys-ink-2);\n}\n\n.xys-error {\n  margin: 16px;\n  padding: 12px;\n  border-left: 4px solid #e34948;\n  background: #fdf0f0;\n  color: var(--xys-ink);\n}\n\n.xys-error-hint {\n  margin-top: 4px;\n  color: var(--xys-ink-2);\n}\n", Et = "bblocks-xy-section-viewer-css";
function Dt(e = globalThis.document) {
	if (!e || e.getElementById(Et)) return;
	let t = e.createElement("style");
	t.id = Et, t.textContent = Tt, e.head.appendChild(t);
}
//#endregion
//#region src/js/xy-section-plugin.js
var Ot = [
	"application/geo+json",
	"application/json",
	"application/ld+json"
], kt = "XYSectionPlugin:", At = class {
	static supportedTypes = Ot;
	static viewName = "XY Section";
	static icon = "mdi-floor-plan";
	constructor(e, t = {}) {
		this.candidates = e ?? [], this._context = t ?? {}, this._candidate = void 0, this._data = null, this._el = null, this._root = null, this._view = null, this._model = null, this._resizeObserver = null, this._fullscreenHandler = null;
	}
	matches() {
		return !!this._pickCandidate();
	}
	_pickCandidate() {
		if (this._candidate !== void 0) return this._candidate;
		let t = this.candidates.find((t) => {
			if (!t?.type || !t.content || !Ot.some((n) => e(n, t.type))) return !1;
			try {
				let e = JSON.parse(t.content);
				return !i(e) || !o(e) || !pe(e).length ? !1 : (this._data = e, !0);
			} catch {
				return !1;
			}
		});
		return this._candidate = t ?? null, this._candidate;
	}
	_loadConfig() {
		return Me(this._context, Pe());
	}
	render(e) {
		return this._el && this.destroy(this._el), this._el = e, e.style.position = "relative", this._mount(e).catch((t) => {
			console.error(`${kt} failed to render`, t), this._el === e && this._showError(e, `Failed to render the XY section view (${t.message}).`);
		});
	}
	async _mount(e) {
		if (!this._pickCandidate()) return;
		Dt(e.ownerDocument);
		let t = await this._loadConfig();
		if (this._el !== e) return;
		t.warnings.forEach((e) => console.warn(`${kt} ${e}`));
		let n = e.ownerDocument, r = n.createElement("div");
		r.className = "xys-root", e.appendChild(r), this._root = r;
		let i = Qe(this._data, t);
		if (this._model = i, !i.levels.length) {
			let e = n.createElement("div");
			e.className = "xys-message", e.textContent = "No floor levels with a section height were found using this block's configuration.", r.appendChild(e);
			return;
		}
		this._view = new wt(r, {
			model: i,
			xySection: t.xySection,
			actions: {
				toggleFullscreen: () => this._toggleFullscreen(),
				isFullscreen: () => this._isFullscreen(),
				download: (e, t) => this._download(e, t)
			}
		}), this._watchLayout(r);
	}
	_isFullscreen() {
		return !!this._root && this._root.ownerDocument.fullscreenElement === this._root;
	}
	_toggleFullscreen() {
		let e = this._root?.ownerDocument;
		this._isFullscreen() ? e?.exitFullscreen?.() : this._root?.requestFullscreen?.();
	}
	_download(e, t) {
		let n = this._root?.ownerDocument, r = globalThis.URL?.createObjectURL?.(new Blob([t], { type: "image/svg+xml" }));
		if (!n || !r) return;
		let i = n.createElement("a");
		i.href = r, i.download = e, i.style.display = "none", n.body.appendChild(i), i.click(), i.remove(), setTimeout(() => URL.revokeObjectURL(r), 0);
	}
	_watchLayout(e) {
		let t = () => {
			this._root === e && this._view?.applyViewMode();
		};
		typeof ResizeObserver < "u" && (this._resizeObserver = new ResizeObserver(t), this._resizeObserver.observe(e)), this._fullscreenHandler = t, e.ownerDocument.addEventListener("fullscreenchange", t);
	}
	_showError(e, t) {
		this.destroy(e);
		let n = e.ownerDocument, r = n.createElement("div");
		r.className = "xys-error", r.setAttribute("role", "alert");
		let i = n.createElement("div");
		i.textContent = t;
		let a = n.createElement("div");
		a.className = "xys-error-hint", a.textContent = "See the browser console for details.", r.append(i, a), e.appendChild(r);
	}
	destroy(e) {
		this._el = null, this._resizeObserver?.disconnect(), this._resizeObserver = null;
		let t = this._root?.ownerDocument ?? e?.ownerDocument;
		this._fullscreenHandler && t?.removeEventListener("fullscreenchange", this._fullscreenHandler), this._fullscreenHandler = null, this._isFullscreen() && t?.exitFullscreen?.(), this._view?.destroy(), this._view = null, this._model = null, this._root?.remove(), this._root = null, e?.replaceChildren?.();
	}
};
//#endregion
export { At as XYSectionPlugin };
