@beautifulMention create this ollama client that supports asyncronous connection.
means this file will handle multiple chat streams at the same time in my app. by the way ollama is installed in my system..

your job. create the functions that does this.

- async stream chat
- handle thinking 
- handle image upload
- function to generate structured outputs and return the response
- handle generate content (no stream generate conent at once.)

make the functions so flexible so that thy can take systemprompts , personality of the ai and the user prompt. with history.

Your job is just to create this file@beautifulMention  nothing else.

Here's the docs you might need as per latest ollama docs:


----------

# Generate a response
Generates a response for the provided prompt

### API
```
curl http://localhost:11434/api/generate -d '{
  "model": "gemma3",
  "prompt": "Why is the sky blue?"
}'
```

### Output:
```
{
  "model": "<string>",
  "created_at": "<string>",
  "response": "<string>",
  "thinking": "<string>",
  "done": true,
  "done_reason": "<string>",
  "total_duration": 123,
  "load_duration": 123,
  "prompt_eval_count": 123,
  "prompt_eval_duration": 123,
  "eval_count": 123,
  "eval_duration": 123,
  "logprobs": [
    {
      "token": "<string>",
      "logprob": 123,
      "bytes": [
        123
      ],
      "top_logprobs": [
        {
          "token": "<string>",
          "logprob": 123,
          "bytes": [
            123
          ]
        }
      ]
    }
  ]
}
```
----

# Generate a chat message
Generate the next chat message in a conversation between a user and an assistant.
### API
```
curl http://localhost:11434/api/chat -d '{
  "model": "gemma3",
  "messages": [
    {
      "role": "user",
      "content": "why is the sky blue?"
    }
  ]
}'
```
### Output:
```
{
  "model": "<string>",
  "created_at": "2023-11-07T05:31:56Z",
  "message": {
    "role": "assistant",
    "content": "<string>",
    "thinking": "<string>",
    "tool_calls": [
      {
        "function": {
          "name": "<string>",
          "description": "<string>",
          "arguments": {}
        }
      }
    ],
    "images": [
      "<string>"
    ]
  },
  "done": true,
  "done_reason": "<string>",
  "total_duration": 123,
  "load_duration": 123,
  "prompt_eval_count": 123,
  "prompt_eval_duration": 123,
  "eval_count": 123,
  "eval_duration": 123,
  "logprobs": [
    {
      "token": "<string>",
      "logprob": 123,
      "bytes": [
        123
      ],
      "top_logprobs": [
        {
          "token": "<string>",
          "logprob": 123,
          "bytes": [
            123
          ]
        }
      ]
    }
  ]
}
```
----

# Generate embeddings
Creates vector embeddings representing the input text
### API
```
curl http://localhost:11434/api/embed -d '{
  "model": "embeddinggemma",
  "input": "Why is the sky blue?"
}'
```
### Output:
```
{
  "model": "embeddinggemma",
  "embeddings": [
    [
      0.010071029,
      -0.0017594862,
      0.05007221,
      0.04692972,
      0.054916814,
      0.008599704,
      0.105441414,
      -0.025878139,
      0.12958129,
      0.031952348
    ]
  ],
  "total_duration": 14143917,
  "load_duration": 1019500,
  "prompt_eval_count": 8
}
```
-----

# List models
Fetch a list of models and their details.

## API

```
curl http://localhost:11434/api/tags
```
### Output:
```
{
  "models": [
    {
      "name": "gemma3",
      "model": "gemma3",
      "modified_at": "2025-10-03T23:34:03.409490317-07:00",
      "size": 3338801804,
      "digest": "a2af6cc3eb7fa8be8504abaf9b04e88f17a119ec3f04a3addf55f92841195f5a",
      "details": {
        "format": "gguf",
        "family": "gemma",
        "families": [
          "gemma"
        ],
        "parameter_size": "4.3B",
        "quantization_level": "Q4_K_M"
      }
    }
  ]
}
```

------

# Show model details
## API
```
curl http://localhost:11434/api/show -d '{
  "model": "gemma3"
}'
```
### Output:
```
{
  "parameters": "temperature 0.7\nnum_ctx 2048",
  "license": "Gemma Terms of Use \n\nLast modified: February 21, 2024...",
  "capabilities": [
    "completion",
    "vision"
  ],
  "modified_at": "2025-08-14T15:49:43.634137516-07:00",
  "details": {
    "parent_model": "",
    "format": "gguf",
    "family": "gemma3",
    "families": [
      "gemma3"
    ],
    "parameter_size": "4.3B",
    "quantization_level": "Q4_K_M"
  },
  "model_info": {
    "gemma3.attention.head_count": 8,
    "gemma3.attention.head_count_kv": 4,
    "gemma3.attention.key_length": 256,
    "gemma3.attention.sliding_window": 1024,
    "gemma3.attention.value_length": 256,
    "gemma3.block_count": 34,
    "gemma3.context_length": 131072,
    "gemma3.embedding_length": 2560,
    "gemma3.feed_forward_length": 10240,
    "gemma3.mm.tokens_per_image": 256,
    "gemma3.vision.attention.head_count": 16,
    "gemma3.vision.attention.layer_norm_epsilon": 0.000001,
    "gemma3.vision.block_count": 27,
    "gemma3.vision.embedding_length": 1152,
    "gemma3.vision.feed_forward_length": 4304,
    "gemma3.vision.image_size": 896,
    "gemma3.vision.num_channels": 3,
    "gemma3.vision.patch_size": 14,
    "general.architecture": "gemma3",
    "general.file_type": 15,
    "general.parameter_count": 4299915632,
    "general.quantization_version": 2,
    "tokenizer.ggml.add_bos_token": true,
    "tokenizer.ggml.add_eos_token": false,
    "tokenizer.ggml.add_padding_token": false,
    "tokenizer.ggml.add_unknown_token": false,
    "tokenizer.ggml.bos_token_id": 2,
    "tokenizer.ggml.eos_token_id": 1,
    "tokenizer.ggml.merges": null,
    "tokenizer.ggml.model": "llama",
    "tokenizer.ggml.padding_token_id": 0,
    "tokenizer.ggml.pre": "default",
    "tokenizer.ggml.scores": null,
    "tokenizer.ggml.token_type": null,
    "tokenizer.ggml.tokens": null,
    "tokenizer.ggml.unknown_token_id": 3
  }
}
```
-----

# Get version
Retrieve the version of the Ollama



## OpenAPI

```
curl http://localhost:11434/api/version
```
### Output:
```
{
  "version": "0.12.6"
}
```