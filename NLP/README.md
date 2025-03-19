# Named Entity Recognition (NER) with CRF and Random Forest

This repository implements Named Entity Recognition (NER) using two machine learning models: Conditional Random Fields (CRF) and Random Forest. The models are trained on the CoNLL-2003 dataset to classify tokens into predefined NER categories such as "B-PER", "I-LOC", and "O". The project includes data preparation, feature extraction, model training, evaluation, and visualization.

## Dataset

The CoNLL-2003 dataset, sourced from the Hugging Face Datasets library (`datasets.load_dataset("conll2003")`), is used for both models. It consists of English text annotated with named entities—Person, Location, Organization, and Miscellaneous. The dataset is split into training, validation, and test sets:

- **CRF**: Loaded entirely into memory.
- **Random Forest**: Loaded with streaming enabled for memory efficiency.

## Common Dependencies

Both models utilize the following libraries:

- `matplotlib.pyplot`: For generating plots.
- `seaborn`: For visualizing data distributions and evaluation metrics.
- `numpy`: For numerical operations.
- `datasets`: For loading the CoNLL-2003 dataset.
- `sklearn.metrics`: For computing classification metrics.
- `collections.Counter`: For counting occurrences of NER tags.
- `os`: For handling file storage and directories.

## CRF Model

### Overview

The CRF model employs sequence labeling to predict NER tags while capturing dependencies between adjacent tokens.

### Key Libraries

- `sklearn_crfsuite.CRF`: Implementation of Conditional Random Fields for sequence labeling.

### Implementation Pipeline

1. **Data Loading**
   - Entire dataset loaded into memory.
   - Extracted token and NER tag sequences.

2. **Feature Extraction**
   - Extracted features such as lowercase form, suffixes, case patterns, digit presence, and context-based information.

3. **Training**
   - Trained CRF using `sklearn_crfsuite.CRF` with L-BFGS optimization, L1/L2 regularization (`c1=0.1`, `c2=0.1`), and 100 iterations.

4. **Evaluation**
   - Generated classification reports.
   - Visualized results via:
     - Precision-Recall curves.
     - Confusion matrices.
     - NER tag distribution plots.
     - Transition feature visualization.

5. **Visualization Styling**
   - Titles: Font size 21.
   - Axis Labels: Font size 18.
   - Bar styling: `edgecolor="black"`, `linewidth=1.5`.
   - All plots saved under `plots/CRF/`.

### Key Outcomes

The CRF model effectively captures sequential dependencies, demonstrating strong performance in structured prediction tasks.

## Random Forest Model

### Overview

The Random Forest model treats NER as a token-level classification problem, leveraging an ensemble of decision trees.

### Key Libraries

- `sklearn.ensemble.RandomForestClassifier`: Implementation of Random Forest.
- `sklearn.preprocessing.LabelEncoder`: For encoding NER tags as numerical values.
- `sklearn.feature_extraction.DictVectorizer`: For transforming feature dictionaries into sparse matrices.
- `scipy.sparse`: For efficient matrix operations.
- `gc`: For memory management during streaming and vectorization.

### Implementation Pipeline

1. **Data Loading**
   - Dataset loaded using streaming for memory efficiency.
   - Processed in chunks.

2. **Feature Extraction**
   - Extracted features similar to CRF.
   - Processed in chunks of 1000 samples.

3. **Vectorization**
   - Features transformed into sparse matrices using `DictVectorizer`.
   - Labels encoded using `LabelEncoder`.

4. **Training**
   - Trained `RandomForestClassifier` (100 trees, balanced class weights, max depth=30, `n_jobs=-1`).

5. **Evaluation**
   - Generated classification reports.
   - Visualized results via:
     - Precision-Recall curves.
     - Confusion matrices.
     - Feature importance plots.

6. **Visualization Styling**
   - Titles: Font size 21.
   - Axis Labels: Font size 18.
   - Bar styling: `edgecolor="black"`, `linewidth=1.5`.
   - All plots saved under `plots/randomForest/`.

### Key Outcomes

The Random Forest model provides robust feature-based classification, with feature importance plots offering insights into key predictors.

## Comparison of CRF and Random Forest

| Aspect            | CRF Model                  | Random Forest Model            |
|------------------|---------------------------|--------------------------------|
| **Model Type**   | Sequence model (CRF)       | Token-level classifier (RF)    |
| **Data Loading** | Entire dataset in memory  | Streaming for efficiency      |
| **Feature Use**  | Context-aware features    | Token-specific features       |
| **Unique Viz**   | Transition weights        | Feature importance ranking    |

## Conclusion

This project explores two approaches to Named Entity Recognition using the CoNLL-2003 dataset:

- **CRF**: Best suited for structured prediction with sequential dependencies.
- **Random Forest**: Effective for scalable token classification with feature-based importance.

All plots and evaluation results are saved for further analysis, showcasing the strengths of each model in NER tasks.

---
## License
This project is for academic and research purposes. Contact the authors for usage permissions.

## Contact
For questions or collaboration, reach out to:
- Manzu Gerald, Ph.D.: manzugerald@gmail.com
- Benson Nyombe Jalle: jallebenie@gmail.com

*Implemented and Developed by Anthony Bush (5th Year Student, School of Computer Science and Information Technology - The University of Juba) under the supervision of Manzu Gerald, Ph.D (Lecturer, University of Juba - School of Computer Science and information Technology)*

