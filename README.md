# Ask Municipal Memory: MVP for Transparent Municipal Council Search

[<img width="1234" alt="new-blog" src="https://github.com/user-attachments/assets/4afbcff2-64a9-4808-81b9-96be4f10eeec" />](https://flo-bit.dev/blog-template/)

## Project Overview

**Ask Municipal Memory** is a Minimum Viable Product (MVP) for a Retrieval-Augmented Generation (RAG) application. Its goal is to enable natural language search through the city council minutes of the municipality of Putanges-le-Lac. The project is designed to promote transparency and make public information more accessible to all citizens.

- **Mission:** Facilitate transparency and accessibility of municipal information by allowing anyone to query council minutes in plain language.
- **Open Source:** This project welcomes contributions and feedback from the community. Feel free to open issues, submit pull requests, or suggest improvements!

## Quick Start

### Local Development

```bash
npm install
npm run dev
```

### Production Build

```bash
npm run build
npm run preview
```

## Technical Specifications

- **Tech Stack:** JavaScript, [Astro](https://astro.build/), [Svelte](https://svelte.dev/), deployed on Vercel.
- **Vector Database:** [Qdrant](https://qdrant.tech/) (SaaS mode).
- **Document Processing:** [Tesseract.js](https://tesseract.projectnaptha.com/) for OCR.
- **No backend in production:** A local script is used to update the vector database; the deployed application is read-only for consultation.
- **LLM:** [Mistral](https://mistral.ai/) via [Hugging Face](https://huggingface.co/).

## How It Works

- Upload and process city council minutes (PDFs, scans, etc.) locally using Tesseract.js for OCR.
- Extracted text is embedded and stored in Qdrant (vector database).
- The web application allows users to ask questions in natural language and retrieves relevant excerpts using RAG and Mistral LLM.
- The deployed app (on Vercel) is for consultation only; updates to the database are performed offline.

## Contributing & Feedback

We encourage contributions and feedback! If you have ideas, find bugs, or want to help, please open an issue or a pull request. Your input helps make municipal information more accessible and transparent for everyone.

## Credits

This project is based on the excellent [Astro blog template by flo-bit](https://github.com/flo-bit/blog-template). Many thanks to flo-bit for the foundation and inspiration!

## License

MIT.
