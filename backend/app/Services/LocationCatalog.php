<?php

namespace App\Services;

use MerkDev\Cities\Turkey;

class LocationCatalog
{
    /** @var array<int, array{name: string, districts: list<string>}> */
    private array $provinces;

    public function __construct()
    {
        /** @var array<int, array{name: string, districts: list<string>}> $provinces */
        $provinces = (new Turkey)->select('*')->get();
        $this->provinces = $provinces;
    }

    /**
     * @return list<string>
     */
    public function cities(): array
    {
        return array_column($this->provinces, 'name');
    }

    /**
     * @return list<string>
     */
    public function districts(string $city): array
    {
        foreach ($this->provinces as $province) {
            if ($province['name'] === $city) {
                return $province['districts'];
            }
        }

        return [];
    }
}
