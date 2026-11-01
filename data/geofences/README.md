# Palestine ADM0 geofence data

The application uses `pse-admin0-ocha.json` as a GeoJSON MultiPolygon to classify a browser-reported point as inside or outside the State of Palestine boundary. It was downloaded from the OCHA/HDX COD-AB dataset: https://data.humdata.org/dataset/cod-ab-pse . The HDX metadata identifies the Palestinian Authority Ministry of Planning as the source, with contribution by OCHA occupied Palestinian territory and quality assurance/publication by OCHA Field Information Services and HDX.

The dataset license is Creative Commons Attribution for Intergovernmental Organisations (CC BY-IGO 3.0): https://creativecommons.org/licenses/by/3.0/igo/legalcode . Attribution is also linked from the site's Privacy Policy. The HDX metadata states that the dataset was reviewed for accuracy and completeness on 24 December 2024 and last modified on 26 January 2026; the underlying boundary source was last edited on 28 September 1995. Review this metadata periodically before updating the boundary.

The boundary is tested against representative points in Gaza City, Ramallah, and East Jerusalem (inside), plus Tel Aviv and Amman (outside). A geoBoundaries PSE ADM0 candidate was not selected because its geometry classified East Jerusalem as outside. A location result is only a device-reported signal for human review, not proof of physical presence or an automatic eligibility/sanctions rule.

HDX metadata lists the next annual review due date as 24 December 2025, which is overdue as of 1 November 2026. A 2026 package modification does not by itself prove the boundary geometry received a fresh accuracy review; verify the current boundary with OCHA/HDX before relying on it operationally.
