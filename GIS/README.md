# A Machine Learning Approach to Urban Growth Prediction of Juba (2024-2033)

## Authors
- **Manzu Gerald, Ph.D.**
- **Benson Nyombe Jalle**

## Project Overview
This project focuses on using a machine learning approach, specifically Random Forest classification, to analyze historical land cover changes in Juba, South Sudan, from 1994 to 2023 and predict urban growth and land cover dynamics from 2024 to 2033. Leveraging Google Earth Engine (GEE), the study processes Landsat satellite imagery to classify land into four categories—Urban, Bare, Water, and Vegetation—and employs spectral change analysis to forecast future land cover trends. The project aims to provide insights into urban expansion and environmental changes in Juba, supporting urban planning and resource management.

**Note:** The term "Urban" here encompasses built environments, including infrastructure, informal settlements, and formal settlements, not strictly dense cityscapes.

## Objectives
1. Classify land cover in Juba for three historical periods: 1994-2003, 2004-2013, and 2014-2023.
2. Calculate area extents and growth rates for each land cover class.
3. Predict land cover distribution for 2024-2033 based on historical trends.
4. Visualize changes through maps, charts, and confusion matrices to assess accuracy and trends.

## Methodology
### Data Sources
- **Landsat Imagery:**
  - **1994-2003:** Landsat 5 (Collection 2, Tier 1, Level 2) surface reflectance and thermal data.
  - **2004-2013 and 2014-2023:** Landsat 7 (Collection 2, Tier 1, Level 2) surface reflectance and thermal data.
- **Ground Control Points (GCPs):**
  - Point collections (`urban2003`, `bare2003`, `water2003`, `vegetation2003`, `urban2013`) defining land cover classes for training.
  - Geometrically-provided via GEE assets / manual input and latter exported as resources - can be used universally.

### Processing Steps
1. **Image Preprocessing:**
   - Scale optical bands (SR_B1 to SR_B7) to reflectance and thermal band (ST_B6) to Kelvin.
   - Mask clouds and shadows using the QA_PIXEL band.
   - Create median composites for each period, clipped to the Juba region of interest (ROI).

2. **Classification:**
   - Train a Random Forest classifier (50 trees) with GCPs and spectral bands.
   - Classify composites into Urban (0), Bare (1), Water (2), and Vegetation (3).
   - Remap and validate classifications using confusion matrices.

3. **Area Calculation:**
   - Compute areas in square kilometers for each class within the ROI.

4. **Prediction:**
   - Calculate annual spectral changes from 1994-2023.
   - Simulate a 2033 composite by extrapolating spectral trends from 2014-2023.
   - Classify the simulated composite and predict areas using growth rates.

5. **Visualization and Export:**
   - Generate maps, time series charts, bar charts, pie charts, and confusion matrices.
   - Export results (classified images, GCPs, areas, charts) to Google Drive.

## Code Structure
The GEE script (`jubaPrediction.js`) is organized as follows:
- **ROI Definition:** Loads Juba geometry and calculates its area.
- **Preprocessing Functions:** `applyScaleFactors` and `maskClouds` for image correction.
- **Classification Functions:** `classifyAndRemap` for historical periods, `classifyAndGetConfusionMatrix` for validation.
- **Area Calculation:** `calculateAreas` computes class extents.
- **Prediction:** `predictUsing1994_2023` forecasts 2033 land cover.
- **Growth Rates:** `calculateGrowthRates` and linear extrapolation for 2024-2033.
- **Visualization:** Charts (line, bar, pie, confusion matrix) for analysis.
- **Exports:** Saves results to Google Drive in folders like `jubaPredictionNew/GCPs`, `Predictions`, and `Charts`.

## Outputs
- **Maps:** Classified land cover for 1994-2003, 2004-2013, 2014-2023, and predicted 2024-2033.
- **Area Statistics:** Square kilometers for each class per period.
- **Growth Rates:** Annual urban growth rates (2003-2013, 2013-2023, 2023-2033).
- **Charts:**
  - Time series (2003-2033) of land cover areas.
  - Bar and stacked bar charts for period comparisons.
  - Pie charts showing class distributions.
  - Confusion matrices for classification accuracy.
- **Exported Files:**
  - Shapefiles: ROI (`ROI_Juba.shp`), GCPs (`GCPs_2003.shp`, etc.).
  - GeoTIFFs: Classified images and composites.
  - CSVs: Area data, chart data, confusion matrices.

## Prerequisites
- **Google Earth Engine Account:** Required to run the script.
- **Assets:** 
  - `table2`: Juba ROI geometry (user-uploaded).
  - GCPs: `urban2003`, `bare2003`, `water2003`, `vegetation2003`, `urban2013` (user-provided point collections).

## How to Run
1. **Setup:**
   - Sign into GEE at [code.earthengine.google.com](https://code.earthengine.google.com).
   - Upload the ROI (`table2`) and GCPs as assets if not already available.

2. **Load Script:**
   - Copy the provided `jubaPrediction.js` into the GEE Code Editor.

3. **Execute:**
   - Run the script to process data, generate outputs, and queue exports.

4. **Export Results:**
   - Open the "Tasks" tab in GEE.
   - Click "Run" next to each export task (e.g., `GCPs_2003`, `Collection_1994_2003`, etc.).
   - Check Google Drive folder `jubaPredictionNew` for results.

5. **View Outputs:**
   - Maps and charts appear in the GEE console.
   - Download exported files for offline analysis (e.g., QGIS for Shapefiles, Excel for CSVs).

## Limitations
- **Data Gaps:** Landsat 7 data post-2003 includes scan line errors, potentially affecting accuracy.
- **GCP Reuse:** 2013 and 2023 use some 2003 GCPs, assuming minimal change in Bare, Water, and Vegetation classes.
- **Prediction Simplification:** Assumes linear spectral change, which may not account for non-linear urban or environmental dynamics.

## Future Work
- Incorporate Landsat 8/9 data for 2014-2023 to improve resolution and accuracy.
- Use updated GCPs for 2023 to reflect recent changes.
- Explore non-linear prediction models (e.g., deep learning) for complex growth patterns.

## License
This project is for academic and research purposes. Contact the authors for usage permissions.

## Contact
For questions or collaboration, reach out to:
- Manzu Gerald, Ph.D.: manzugerald@gmail.com
- Benson Nyombe Jalle: jallebenie@gmail.com

*Implemented and Developed by Nyombe Benson Jalle (5th Year Student, School of Computer Science and Information Technology - The University of Juba) under the supervision of Manzu Gerald, Ph.D (Lecturer, University of Juba - School of Computer Science and information Technology)*