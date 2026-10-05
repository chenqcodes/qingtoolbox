# Paper-fold cosmic journey

The journey now contains 46 explicitly defined lengths. Six stars larger than the Sun are followed by planetary-orbit spans, nearby-star distance, nebulae, a star cluster, galaxies, intergalactic distances, a flow-defined supercluster and the observable universe.

## Scientific definitions

- Stellar source radii in solar radii become the same ratio of solar diameters, never an additional factor of two. Diameters use the existing 1,391,400 km solar reference
- Sirius A: 1.713; Arcturus: 25.4; Aldebaran: 44.2 solar radii. Primary papers/institute publication records are linked on each reference
- Antares: optical diameter about 700 solar diameters (ESO). Betelgeuse: stellar-model radius 764 +116/-62 solar radii (Joyce et al. 2020). VY CMa: Rosseland photospheric radius 1420 ±120 solar radii (Wittkowski et al. 2012). No largest-star ranking is claimed
- Neptune's approximately 60 AU orbital diameter is not a boundary of the entire solar system
- Orion Nebula 24 ly; Omega Centauri 150 ly; N44 whole complex 1000 ly; Small Magellanic Cloud 7000 ly; Milky Way stellar disk 100,000 ly. These are approximate extents
- Andromeda 2.5 million ly and M87 54 million ly are distances from Earth, not their diameters
- Laniakea's approximately 520 million ly span follows the 160 Mpc galaxy-flow definition in Tully et al. 2014; it is not a solid spherical object
- Observable-universe diameter: NASA's rounded 2025 educational estimate of 92 billion ly at the present epoch, accounting for expansion. The size of the entire universe remains unknown

## Endpoint and coverage

The maximum selectable fold is the first crossing of the observable-universe reference: 107 folds at 0.01 mm, 103 at 0.1 mm, 100 at 1 mm. The mathematical safety cap is 107. Changing paper thickness clamps the current selected fold when necessary. There is no invented object beyond the observable-universe reference; the next card explains the unknown total size.

Unit tests cover all 100 paper settings in 0.01 mm increments, all fractional eighth-fold positions and both 199/260 px scene areas. Every valid journey frame retains a fully opaque reference at least 10 px tall. Model tests check first crossings, exact BigInt layers and finite units throughout the complete range.

Browser tests cover smooth jumps through the stellar and galactic ladder; endpoint playback; reduced motion; interrupts and reset; keyboard controls; all integer folds at extreme paper thicknesses; 1440/390/320 px layouts; and screenshots of stellar, orbital, galactic and endpoint scenes. The existing CI runs all repository checks plus Chromium tests and uploads screenshots for inspection.
