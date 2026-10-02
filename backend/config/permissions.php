<?php

return [
    'roles' => [
        'super_admin' => ['*'],
        'admin' => [
            'admin.dashboard.view',
            'admin.shops.manage',
            'admin.sliders.manage',
            'admin.sponsors.manage',
            'admin.content.moderate',
            'admin.users.view',
            'admin.users.manage',
            'admin.support.manage',
        ],
        'moderator' => [
            'admin.dashboard.view',
            'admin.content.moderate',
            'admin.support.manage',
        ],
    ],
];
