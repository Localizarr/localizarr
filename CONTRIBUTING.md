# How to Contribute

We're always looking for people to help make Localizarr even better. There are several ways to contribute.

## Documentation

Setup guides, [FAQ](https://github.com/Localizarr/localizarr/wiki), the more information we have on the [wiki](https://github.com/Localizarr/localizarr/wiki), the better.

## Development

### Required Tools

- [Node.js](https://nodejs.org/) (version 18.x or higher)
- [Git](https://git-scm.com/downloads)
- Code editor of your choice (VS Code, WebStorm, etc.)
- [Docker](https://www.docker.com/) (optional, but recommended for development)

### Getting Started

1. Fork Localizarr
2. Clone the repository into your development machine. [_info_](https://docs.github.com/en/get-started/quickstart/fork-a-repo)
3. Install Node.js dependencies `npm install`
4. Configure the development environment:
   - Copy `.env.example` to `.env`
   - Configure the necessary environment variables
5. Run database migrations `npm run reset:db`
6. Start the development server `npm run dev`
7. Open [http://localhost:5005](http://localhost:5005)

### Contributing Code

- If you're adding an already requested feature, please comment on [GitHub Issues](https://github.com/Localizarr/localizarr/issues) to avoid duplicate work
- Rebase from Localizarr's `master` branch, don't merge
- Make meaningful commits, or squash them
- Feel free to make a pull request before work is complete - this allows us to see progress and make comments/suggestions
- Reach out to us on [Telegram](https://t.me/vinicioslc) or [GitHub Discussions](https://github.com/Localizarr/localizarr/discussions) if you have any questions
- Add tests (unit/integration)
- Commit with *nix line endings for consistency (We checkout on Windows and commit*nix)
- One feature/bug fix per pull request to keep things clean and easy to understand
- Use 2 spaces instead of tabs (standard for JavaScript/TypeScript projects)

### Pull Requests

- Make pull requests only to the default branch (`master`)
- You'll probably get comments or questions from us, they will be to ensure consistency and maintainability
- We'll try to respond to pull requests as soon as possible, if it's been a day or two, please reach out to us - we may have missed it
- Each PR should come from its own [feature branch](http://martinfowler.com/bliki/FeatureBranch.html), not develop in your fork, and should have a meaningful branch name
  - new-feature (Good)
  - bug-fix (Good)
  - patch (Bad)
  - develop (Bad)

### Project Structure

```text
localizarr/
├── app/                    # Application code
│   ├── controllers/        # API controllers
│   ├── models/            # Database models
│   ├── services/          # Business logic
│   └── middleware/        # Middlewares
├── database/              # Migrations and seeders
├── public/                # Static assets
├── resources/            # Frontend views and assets
│   └── views/            # Edge.js templates
├── start/                # Startup files
├── tests/                # Tests
│   ├── functional/       # Functional tests
│   └── llm-integration/  # LLM integration tests
├── config/               # Configurations
├── bin/                  # Executable scripts
└── ace.js               # AdonisJS CLI
```

### Running Tests

```bash
# All tests (except LLM)
npm test

# Only LLM integration tests
npm run test:llm-integration

# All tests
npm run test:all

# Reset database for tests
npm run reset:db
```

### Docker Development

For Docker development:

```bash
# Build development image
docker build -f Dockerfile.dev -t localizarr:dev .

# Run development container
docker run -p 5005:5005 -v $(pwd):/app localizarr:dev
```

### Code Guidelines

- **TypeScript**: Use static typing whenever possible
- **AdonisJS**: Follow framework conventions
- **Vue.js**: For frontend components, follow Vue 3 best practices
- **Tests**: Maintain high test coverage, especially for critical logic
- **Documentation**: Document complex functions and public APIs
- **Commits**: Use descriptive messages in English or Portuguese

### Contribution Areas

- **LLM Processing**: Improve title analysis algorithms
- **Language Support**: Add support for new languages
- **Web Interface**: Improve UI/UX
- **Performance**: Optimize caching and processing
- **Integrations**: Support for new indexers or *Arrs
- **Tests**: Increase test coverage
- **Documentation**: Guides, tutorials, and examples

If you have any questions about anything, please let us know!
