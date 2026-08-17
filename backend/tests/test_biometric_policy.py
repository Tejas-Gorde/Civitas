import numpy as np
import pytest
from app.services.biometrics import cosine_similarity


def test_identical_facenet_vectors_are_perfect_similarity():
    embedding = np.array([1.0, 2.0, 3.0], dtype=np.float32)
    assert cosine_similarity(embedding, embedding) == pytest.approx(1.0)


def test_orthogonal_vectors_do_not_pass_face_threshold():
    assert cosine_similarity(np.array([1., 0.]), np.array([0., 1.])) == 0.0
