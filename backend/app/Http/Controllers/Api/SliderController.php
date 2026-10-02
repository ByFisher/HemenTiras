<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Slider;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class SliderController extends Controller
{
    public function publicIndex()
    {
        return response()->json(
            Slider::query()
                ->where('is_active', true)
                ->orderBy('sort_order')
                ->orderBy('id')
                ->get()
                ->map(fn (Slider $slider) => $this->publicData($slider))
                ->values(),
        );
    }

    public function adminIndex()
    {
        return response()->json(
            Slider::query()
                ->orderBy('sort_order')
                ->orderBy('id')
                ->get()
                ->map(fn (Slider $slider) => $this->adminData($slider))
                ->values(),
        );
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:160'],
            'description' => ['nullable', 'string', 'max:1000'],
            'image' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
            'link_url' => ['nullable', 'string', 'max:2048'],
            'link_label' => ['nullable', 'string', 'max:80'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:100000'],
            'is_active' => ['required', 'boolean'],
        ]);
        $this->validateLink($data['link_url'] ?? null);

        /** @var UploadedFile $image */
        $image = $data['image'];
        $path = $image->storePublicly('sliders', 'public');
        unset($data['image']);
        $slider = Slider::query()->create([
            ...$data,
            'image_path' => $path,
            'sort_order' => $data['sort_order'] ?? ((int) (Slider::query()->max('sort_order') ?? -1) + 1),
        ]);

        return response()->json($this->adminData($slider), 201);
    }

    public function update(Request $request, Slider $slider)
    {
        $data = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:160'],
            'description' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'image' => ['sometimes', 'required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
            'link_url' => ['sometimes', 'nullable', 'string', 'max:2048'],
            'link_label' => ['sometimes', 'nullable', 'string', 'max:80'],
            'sort_order' => ['sometimes', 'required', 'integer', 'min:0', 'max:100000'],
            'is_active' => ['sometimes', 'required', 'boolean'],
        ]);
        $this->validateLink($data['link_url'] ?? null);

        $oldImagePath = $slider->image_path;
        if (isset($data['image'])) {
            /** @var UploadedFile $image */
            $image = $data['image'];
            $data['image_path'] = $image->storePublicly('sliders', 'public');
            unset($data['image']);
        }

        $slider->update($data);
        if (isset($data['image_path'])) {
            Storage::disk('public')->delete($oldImagePath);
        }

        return response()->json($this->adminData($slider->refresh()));
    }

    public function destroy(Slider $slider)
    {
        $imagePath = $slider->image_path;
        $slider->delete();
        Storage::disk('public')->delete($imagePath);

        return response()->noContent();
    }

    public function reorder(Request $request)
    {
        $data = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['required', 'integer', 'distinct', 'exists:sliders,id'],
        ]);
        if (count($data['ids']) !== Slider::query()->count()) {
            throw ValidationException::withMessages([
                'ids' => 'Sıralama isteği tüm banner kayıtlarını içermelidir.',
            ]);
        }

        DB::transaction(function () use ($data): void {
            foreach ($data['ids'] as $position => $id) {
                Slider::query()->whereKey($id)->update(['sort_order' => $position]);
            }
        });

        return $this->adminIndex();
    }

    private function validateLink(?string $link): void
    {
        if ($link === null || $link === '') {
            return;
        }

        $isRelative = str_starts_with($link, '/') && ! str_starts_with($link, '//');
        $scheme = parse_url($link, PHP_URL_SCHEME);
        $isWebUrl = filter_var($link, FILTER_VALIDATE_URL) && in_array($scheme, ['http', 'https'], true);

        if (! $isRelative && ! $isWebUrl) {
            throw ValidationException::withMessages([
                'link_url' => 'Yönlendirme bağlantısı site içi bir yol veya HTTP(S) adresi olmalıdır.',
            ]);
        }
    }

    private function publicData(Slider $slider): array
    {
        return [
            'id' => (string) $slider->id,
            'title' => $slider->title,
            'description' => $slider->description,
            'imageUrl' => Storage::disk('public')->url($slider->image_path),
            'linkUrl' => $slider->link_url,
            'linkLabel' => $slider->link_label,
        ];
    }

    private function adminData(Slider $slider): array
    {
        return [
            ...$this->publicData($slider),
            'isActive' => $slider->is_active,
            'sortOrder' => $slider->sort_order,
        ];
    }
}
