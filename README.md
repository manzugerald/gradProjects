# Grad Projects - University of Juba

This repository contains three projects:
1. **Comparative performance of Traditional and Machine Learning Approaches in Named Entity Recognition (NER) u the CoNLL-2003 Dataset** - Implements NER using Conditional Random Fields (CRF) and Random Forest models on the CoNLL-2003 dataset.
2. **Temperature Time Series Prediction using Holt-Winters and ARIMA** - Forecasts temperature data using Holt-Winters and ARIMA models.
3. **A Machine Learning Approach to Urban Growth Prediction of Juba (2024-2033)** - Predicts land cover changes in Juba, South Sudan, using Random Forest on Landsat imagery.

## 1. Comparative performance of Traditional and Machine Learning Approaches Using the CoNLL-2003 Dataset
This project applies Named Entity Recognition (NER) using two machine learning approaches: CRF and Random Forest. The models classify tokens into predefined NER categories such as "B-PER", "I-LOC", and "O" using the CoNLL-2003 dataset.

### Dataset
- **Source:** CoNLL-2003 dataset from Hugging Face (`datasets.load_dataset("conll2003")`).
- **Entities:** Person, Location, Organization, and Miscellaneous.
- **Data Handling:**
  - CRF loads the dataset into memory.
  - Random Forest uses streaming for efficiency.

### Common Dependencies
- `matplotlib`, `seaborn`: For visualization.
- `numpy`, `datasets`, `sklearn.metrics`: For computations and dataset handling.
- `collections.Counter`, `os`: For feature extraction and file handling.

### CRF Model
- **Uses** `sklearn_crfsuite.CRF` for sequence labeling.
- **Feature Extraction:** Context-based features (lowercase form, suffixes, case patterns, digit presence).
- **Training:** L-BFGS optimization, L1/L2 regularization (`c1=0.1`, `c2=0.1`), 100 iterations.
- **Evaluation:** Precision-Recall curves, confusion matrices, transition feature visualization.

### Random Forest Model
- **Uses** `sklearn.ensemble.RandomForestClassifier` for classification.
- **Feature Extraction:** Token-based features processed in chunks.
- **Training:** 100 trees, balanced class weights, max depth=30 (`n_jobs=-1`).
- **Evaluation:** Feature importance ranking, confusion matrices.

### Model Comparison
| Aspect | CRF Model | Random Forest Model |
|--------|-----------|---------------------|
| **Model Type** | Sequence labeling (CRF) | Token-level classifier (RF) |
| **Data Handling** | Entire dataset in memory | Streaming for efficiency |
| **Feature Use** | Context-aware features | Token-specific features |
| **Visualization** | Transition weights | Feature importance ranking |

### Conclusion
- **CRF:** Best for structured sequence prediction.
- **Random Forest:** Effective for feature-based classification.

## 2. Temperature Time Series Prediction using Holt-Winters and ARIMA
This project forecasts temperature trends using Holt-Winters and ARIMA models with a dataset spanning from 1920 to 2022.

### Features
- Preprocessing: Outlier removal with rolling mean and exponential smoothing.
- Models: Holt-Winters (additive trend and seasonal model), ARIMA (1,1,1 order).
- Metrics: RMSE, R², Kling-Gupta Efficiency (KGE).
- Visualization: Observed vs. predicted values.

### Dependencies
Install necessary packages before running the script:
```bash
pip install pandas numpy matplotlib seaborn statsmodels scikit-learn
```

### Usage
1. **Load Data:** Ensure the dataset (`data.csv`) has `Year` and `Smooth_5yr` columns.
2. **Run the Script:** Train models and generate predictions.
3. **Check Output:** Results saved in `output_plots/`.

### Data Preprocessing
- **Splits:**
  - Training: 1920-2012
  - Validation: 2013-2022
  - Future Prediction: 2023-2030

### Model Training & Evaluation
- **Holt-Winters:** Captures seasonal trends.
- **ARIMA:** Statistical time series forecasting.
- **Evaluation Metrics:** RMSE, R², KGE.

### Results & Visualization
- Metrics stored in `evaluation_results.xlsx`.
- Plots saved in `output_plots/`, including:
  - **Time Series Plot:** `timeseries_1920_2022.png`
  - **Training vs. Observed vs. Prediction:** `training_vs_observed_vs_prediction.png`
  - **Actual vs. Predicted:** `actual_vs_predicted.png`


## 3. A Machine Learning Approach to Urban Growth Prediction of Juba (2024-2033)

## Project Overview
This project aims to predict urban growth and land cover changes in Juba, South Sudan, from 2024 to 2033, using a Random Forest machine learning approach to analyze historical satellite data and forecast future trends in the region.

## Dataset
- **Source:** Landsat 5 (1994-2003) and Landsat 7 (2004-2023) imagery from Google Earth Engine.
- **Classes:** Urban (built environments), Bare, Water, Vegetation.
- **GCPs:** User-provided ground control points (e.g., `urban2003`, `urban2013`) for training.

## Model
- **Random Forest:** Uses `ee.Classifier.smileRandomForest(50)` with 50 trees.
- **Features:** Spectral bands (SR_B1-SR_B7, ST_B6).
- **Training:** Trained on historical GCPs.
- **Evaluation:** Assessed via confusion matrices.

## Features and Outputs
- **Preprocessing:** Scales reflectance/thermal bands, masks clouds, creates median composites.
- **Prediction:** Extrapolates spectral changes from 1994-2023 to simulate 2033 land cover.
- **Outputs:** Classified maps, area statistics, growth rates, visualized via time series, bar, and pie charts.

## Dependencies and Usage
- **Dependencies:** Google Earth Engine (GEE) account and access.
- **Usage:**
  1. Upload ROI (`table2`) and GCPs to GEE assets.
  2. Run the script in GEE Code Editor.
  3. Export results to Google Drive (`jubaPredictionNew/`) via Tasks tab.

## Contact
For questions or collaboration, reach out to:
### Supervisor
- Supervisor Manzu Gerald, Ph.D.: manzugerald@gmail.com
### Students
- Benson Nyombe Jalle: jallebenie@gmail.com
- Alier Ajak Achuek : alierajak19@gmail.com
- Anthony Bush: anthonybush211@gmail.com
- Deng John Akhok : dengjohnakhok@gmail.com

*Implemented and Developed by Benson Nyombe, Deng John Akhok, Alier Ajak Achuek, Anthony Bush (5th Year Students, School of Computer Science and Information Technology - The University of Juba) under the supervision of Manzu Gerald, Ph.D (Lecturer, University of Juba - School of Computer Science and information Technology)*


