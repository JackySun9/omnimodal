# Contributing to Unified Multimodal Platform

First off, thank you for considering contributing to the Unified Multimodal Platform! 🎉

The following is a set of guidelines for contributing to this project. These are mostly guidelines, not rules. Use your best judgment, and feel free to propose changes to this document in a pull request.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Enhancements](#suggesting-enhancements)
  - [Your First Code Contribution](#your-first-code-contribution)
  - [Pull Requests](#pull-requests)
- [Development Setup](#development-setup)
- [Style Guidelines](#style-guidelines)
  - [Git Commit Messages](#git-commit-messages)
  - [Python Style Guide](#python-style-guide)
  - [TypeScript Style Guide](#typescript-style-guide)
- [Testing](#testing)
- [Documentation](#documentation)

## Code of Conduct

This project and everyone participating in it is governed by our commitment to provide a welcoming and inspiring community for all. By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

### Our Standards

**Examples of behavior that contributes to a positive environment:**
- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

**Examples of unacceptable behavior:**
- The use of sexualized language or imagery and unwelcome sexual attention or advances
- Trolling, insulting/derogatory comments, and personal or political attacks
- Public or private harassment
- Publishing others' private information without explicit permission
- Other conduct which could reasonably be considered inappropriate in a professional setting

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When you create a bug report, include as many details as possible:

**Bug Report Template:**

```markdown
**Describe the bug**
A clear and concise description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
A clear description of what you expected to happen.

**Screenshots**
If applicable, add screenshots to help explain your problem.

**Environment:**
 - OS: [e.g., macOS 14.0]
 - Python Version: [e.g., 3.11.5]
 - Node Version: [e.g., 20.10.0]
 - Backend Version: [e.g., 0.1.0]
 - Frontend Version: [e.g., 0.1.0]

**Additional context**
Add any other context about the problem here.
```

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, include:

- **Use a clear and descriptive title**
- **Provide a detailed description of the suggested enhancement**
- **Explain why this enhancement would be useful**
- **List any alternative solutions or features you've considered**

### Your First Code Contribution

Unsure where to begin? You can start by looking through these issues:

- **Good First Issue** - Issues that are good for newcomers
- **Help Wanted** - Issues that need assistance

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Install dependencies** for both backend and frontend
3. **Make your changes** following the style guidelines
4. **Add tests** if you've added code that should be tested
5. **Ensure all tests pass**
6. **Update documentation** if needed
7. **Commit your changes** using descriptive commit messages
8. **Push to your fork** and submit a pull request

**Pull Request Template:**

```markdown
## Description
A clear description of what this PR does.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## How Has This Been Tested?
Describe the tests you ran and how to reproduce them.

## Checklist:
- [ ] My code follows the style guidelines of this project
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
```

## Development Setup

### Prerequisites

- Python 3.11+
- Node.js 20+
- uv (Python package manager)
- pnpm (Node package manager)
- Rust toolchain (for Tauri)

### Backend Setup

```bash
cd backend
uv sync --dev
uv run uvicorn app.main:app --reload
```

### Frontend Setup

```bash
cd frontend
pnpm install
pnpm dev:web
```

### Running Tests

```bash
# Backend tests
cd backend
uv run pytest

# Frontend tests (when added)
cd frontend
pnpm test
```

## Style Guidelines

### Git Commit Messages

Use the following format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that don't affect code meaning (formatting, etc.)
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvement
- `test`: Adding missing tests
- `chore`: Changes to build process or auxiliary tools

**Examples:**

```
feat(backend): add model quantization support

Implement GGUF quantization for text models using llama.cpp
integration. Adds new API endpoint and service layer.

Closes #123
```

```
fix(frontend): resolve image generation timeout issue

Increase default timeout for image generation requests from 30s to 60s
to accommodate larger models.

Fixes #456
```

### Python Style Guide

We follow [PEP 8](https://pep8.org/) with some modifications:

- **Line Length**: Maximum 100 characters (not 79)
- **Imports**: Use absolute imports, grouped in this order:
  1. Standard library imports
  2. Related third-party imports
  3. Local application imports
- **Type Hints**: Always use type hints for function parameters and return values
- **Docstrings**: Use Google-style docstrings

**Formatting:**

```bash
cd backend
uv run ruff format app/
uv run ruff check app/ --fix
```

**Example:**

```python
from typing import Optional, List

from fastapi import APIRouter, HTTPException
from sqlmodel import Session

from app.models.local_model import LocalModel
from app.schemas.models import ModelResponse


async def get_model(
    model_id: int,
    session: Session
) -> Optional[LocalModel]:
    """
    Retrieve a model by ID from the database.

    Args:
        model_id: The unique identifier of the model.
        session: Database session.

    Returns:
        The model if found, None otherwise.

    Raises:
        HTTPException: If the model is not found.
    """
    model = session.get(LocalModel, model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    return model
```

### TypeScript Style Guide

We use TypeScript with strict mode enabled:

- **Semicolons**: Not required (but consistent)
- **Quotes**: Single quotes for strings
- **Indentation**: 2 spaces
- **Naming**:
  - PascalCase for components, interfaces, types
  - camelCase for variables, functions
  - UPPER_CASE for constants

**Linting:**

```bash
cd frontend
pnpm lint
```

**Example:**

```typescript
interface ModelCardProps {
  model: LocalModel;
  onSelect: (modelId: number) => void;
}

export function ModelCard({ model, onSelect }: ModelCardProps) {
  const handleClick = () => {
    onSelect(model.id);
  };

  return (
    <div className="model-card" onClick={handleClick}>
      <h3>{model.name}</h3>
      <p>{model.modality}</p>
    </div>
  );
}
```

## Testing

### Backend Testing

Use pytest for backend tests:

```python
# tests/test_hardware.py
import pytest
from app.services.hardware import hardware_service


@pytest.mark.asyncio
async def test_detect_hardware():
    """Test hardware detection returns valid profile."""
    profile = await hardware_service.detect_hardware()
    
    assert profile is not None
    assert profile.cpu.cores_physical > 0
    assert profile.memory.total_gb > 0
```

### Frontend Testing

Use React Testing Library:

```typescript
// src/ui/components/__tests__/ModelCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ModelCard } from '../ModelCard';

describe('ModelCard', () => {
  it('renders model name', () => {
    const model = { id: 1, name: 'Test Model', modality: 'text' };
    render(<ModelCard model={model} onSelect={() => {}} />);
    
    expect(screen.getByText('Test Model')).toBeInTheDocument();
  });

  it('calls onSelect when clicked', () => {
    const onSelect = jest.fn();
    const model = { id: 1, name: 'Test Model', modality: 'text' };
    render(<ModelCard model={model} onSelect={onSelect} />);
    
    fireEvent.click(screen.getByText('Test Model'));
    expect(onSelect).toHaveBeenCalledWith(1);
  });
});
```

## Documentation

### Code Comments

- Write comments for complex logic
- Avoid obvious comments
- Keep comments up-to-date with code changes

### API Documentation

All API endpoints should be documented using FastAPI's automatic documentation:

```python
@router.get("/models/{model_id}", response_model=ModelResponse)
async def get_model(
    model_id: int,
    session: Session = Depends(get_session)
) -> ModelResponse:
    """
    Retrieve a specific model by ID.

    This endpoint returns detailed information about a single model,
    including its configuration, file paths, and metadata.

    Args:
        model_id: The unique identifier of the model

    Returns:
        Complete model information

    Raises:
        HTTPException: 404 if model not found
    """
    # Implementation
```

### README Updates

If your changes affect setup, usage, or features, update the relevant documentation:

- `README.md` - Main project documentation
- `QUICKSTART.md` - Getting started guide
- `SERVICES_GUIDE.md` - Service management
- `TROUBLESHOOTING.md` - Common issues

## Additional Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com)
- [React Documentation](https://react.dev)
- [Tauri Documentation](https://tauri.app)
- [Python Type Hints](https://docs.python.org/3/library/typing.html)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## Recognition

Contributors will be recognized in:
- The project README
- Release notes
- A dedicated CONTRIBUTORS.md file

## Questions?

Feel free to:
- Open an issue with the `question` label
- Start a discussion in the Discussions tab
- Reach out to maintainers

---

**Thank you for contributing to the Unified Multimodal Platform!** 🚀

Your contributions help make local AI more accessible to everyone.
