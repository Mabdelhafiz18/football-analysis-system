import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, accuracy_score
import joblib
from sklearn.ensemble import ExtraTreesClassifier


df = pd.read_csv("ml_foul_dataset.csv")

features = ["avg_motion", "max_motion", "std_motion"]
train_df = df[df["split"] == "train"]
val_df = df[df["split"] == "val"]
test_df = df[df["split"] == "test"]

X_train = train_df[features]
y_train = train_df["label"].apply(lambda x: "foul" if x == "foul" else "normal")

X_val = val_df[features]
y_val = val_df["label"].apply(lambda x: "foul" if x == "foul" else "normal")

X_test = test_df[features]
y_test = test_df["label"].apply(lambda x: "foul" if x == "foul" else "normal")

from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

model = make_pipeline(
    StandardScaler(),
    SVC(
        kernel="rbf",
        class_weight="balanced",
        probability=True,
        random_state=42
    )
)

model.fit(X_train, y_train)

print("\nValidation Results:")
val_pred = model.predict(X_val)
print("Accuracy:", accuracy_score(y_val, val_pred))
print(classification_report(y_val, val_pred))

print("\nTest Results:")
test_pred = model.predict(X_test)
print("Accuracy:", accuracy_score(y_test, test_pred))
print(classification_report(y_test, test_pred))

joblib.dump(model, "ml_foul_model.pkl")
print("\nSaved model: ml_foul_model.pkl")