<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Shop;
use Illuminate\Http\Request;

class FavoriteController extends Controller
{
    public function index(Request $request)
    {
        return response()->json($request->user()->favoriteShops()
            ->where('shops.status', 'active')
            ->where('shops.is_approved', true)
            ->orderBy('shops.name')
            ->pluck('shops.id')
            ->map(fn (int $shopId): string => (string) $shopId));
    }

    public function store(Request $request, Shop $shop)
    {
        abort_unless($shop->status === 'active' && $shop->is_approved, 404);
        $request->user()->favoriteShops()->syncWithoutDetaching([$shop->id]);

        return response()->json(['shopId' => (string) $shop->id, 'isFavorite' => true]);
    }

    public function destroy(Request $request, Shop $shop)
    {
        $request->user()->favoriteShops()->detach($shop->id);

        return response()->json(['shopId' => (string) $shop->id, 'isFavorite' => false]);
    }
}
