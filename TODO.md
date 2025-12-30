# TODO: Spherical Visualization Mode

## Overview

Add an alternative visualization mode that maps audio data onto a sphere rather than extruding it along a ring-based corridor. This mode would be particularly meaningful for data derived from spherical harmonic analysis, such as the cosmic microwave background (CMB).

## Rationale

The current ring/corridor topology is experientially compelling but geometrically arbitrary for mono sources where the L/R phase relationship that Lissajous curves are designed to reveal doesn't exist. For certain data sources, spherical mapping provides stronger conceptual correspondence:

### CMB and Cosmological Data

The cosmic microwave background is inherently spherical - it represents radiation from a shell surrounding us at the edge of the observable universe. The Planck multipole spectrum that Cramer used to generate the Big Bang audio (https://faculty.washington.edu/jcramer/BBSound_2013.html) is literally a spherical harmonic decomposition (the l values are spherical harmonic degrees). Mapping this audio onto a sphere places the viewer _inside_ the surface of last scattering, looking outward at primordial acoustic oscillations frozen in light.

### Planetary and Geophysical Data

Spherical harmonics are used to model Earth's gravitational field, magnetic field, and seismic data. Audio derived from these sources would map naturally to a globe representation.

### Resonance and Modal Analysis

Spherical objects (bells, drums, planets) have vibrational modes described by spherical harmonics. Sonifications of these phenomena would be geometrically honest on a sphere.
